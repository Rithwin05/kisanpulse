import os
import uuid
import random
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from engine import forecast as fcst
from engine.nrv import compute_nrv, transport_cost, constants
from engine.match import score_buyer, haversine_km
from engine.decide import decide
from data.geo import DISTRICTS, MARKETS
from data import ingest as ingest_mod, seed as seed_mod

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("kisanpulse")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="KisanPulse API")
api = APIRouter(prefix="/api")
scheduler = AsyncIOScheduler()
NOID = {"_id": 0}
FORECAST_MEM = {}
STALE_DAYS = 3
FARMER = {"name": "Ramesh Patil", "village": "Niphad", "district": "Nashik", "lat": 20.08, "lon": 74.11, "fpo": "Niphad Farmer Producer Co."}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def demo_today() -> date:
    pinned = os.environ.get("DEMO_TODAY")
    if pinned:
        return date.fromisoformat(pinned)
    doc = await db.prices.find_one({}, {"_id": 0, "date": 1}, sort=[("date", -1)])
    return date.fromisoformat(doc["date"]) if doc else date.today()


async def audit(event, lot_id=None, payload=None, actor="farmer"):
    doc = {"id": str(uuid.uuid4()), "ts": now_iso(), "event": event, "lot_id": lot_id, "actor": actor, "payload": payload or {}}
    await db.audit_log.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- prices ----------------
def market_info(commodity, market):
    for (m, d, lat, lon, _) in MARKETS.get(commodity, []):
        if m == market:
            return {"market": m, "district": d, "lat": lat, "lon": lon}
    return None


async def series_by_market(commodity, min_days=60):
    cur = db.prices.find({"commodity": commodity, "anomaly": False}, {"_id": 0, "market": 1, "date": 1, "modal_price": 1})
    recs = await cur.to_list(200000)
    by = {}
    for r in recs:
        by.setdefault(r["market"], []).append(r)
    return {m: fcst.to_daily(v) for m, v in by.items() if len(v) >= min_days}


async def latest_price(commodity, market=None, district=None):
    q = {"commodity": commodity, "anomaly": False}
    level = "local"
    if market:
        q["market"] = market
    doc = await db.prices.find_one(q, NOID, sort=[("date", -1)])
    if not doc and district:
        doc = await db.prices.find_one({"commodity": commodity, "district": district, "anomaly": False}, NOID, sort=[("date", -1)])
        level = "district"
    if not doc:
        doc = await db.prices.find_one({"commodity": commodity, "state": "Maharashtra", "anomaly": False}, NOID, sort=[("date", -1)])
        level = "state"
    if not doc:
        doc = await db.prices.find_one({"commodity": commodity, "anomaly": False}, NOID, sort=[("date", -1)])
        level = "national"
    return doc, level


def source_chip(doc):
    if not doc:
        return "no data"
    return f"Agmarknet {doc['date']}" if doc["source"] == "agmarknet" else f"synthetic-seasonal {doc['date']}"


@api.get("/prices/meta")
async def prices_meta():
    today = await demo_today()
    out = []
    for com in MARKETS:
        latest = await db.prices.find_one({"commodity": com}, NOID, sort=[("date", -1)])
        n = await db.prices.count_documents({"commodity": com})
        anomalies = await db.prices.count_documents({"commodity": com, "anomaly": True})
        first = await db.prices.find_one({"commodity": com}, NOID, sort=[("date", 1)])
        out.append({"commodity": com, "records": n, "anomalies_flagged": anomalies, "source": latest["source"] if latest else None,
                    "latest_date": latest["date"] if latest else None, "first_date": first["date"] if first else None,
                    "markets": [m[0] for m in MARKETS[com]]})
    ingest_meta = await db.meta.find_one({"key": "ingest"}, NOID)
    return {"demo_today": today.isoformat(), "commodities": out, "last_ingest": (ingest_meta or {}).get("last_run"),
            "note": "synthetic-seasonal = labelled fallback generated from Lasalgaon seasonality; Agmarknet fetch retried by scheduler"}


@api.get("/prices/series")
async def prices_series(commodity: str = "Onion", market: str = "Lasalgaon", days: int = 365):
    today = await demo_today()
    start = (today - timedelta(days=days)).isoformat()
    cur = db.prices.find({"commodity": commodity, "market": market, "date": {"$gte": start}}, NOID).sort("date", 1)
    recs = await cur.to_list(5000)
    return {"commodity": commodity, "market": market, "points": [
        {"date": r["date"], "modal": r["modal_price"], "min": r["min_price"], "max": r["max_price"], "anomaly": r["anomaly"], "source": r["source"]}
        for r in recs]}


@api.get("/prices/latest")
async def prices_latest(commodity: str = "Onion", district: str = "Nashik"):
    today = await demo_today()
    out = []
    for (m, d, lat, lon, _) in MARKETS.get(commodity, []):
        doc, _lvl = await latest_price(commodity, m)
        if not doc:
            continue
        prev = await db.prices.find_one({"commodity": commodity, "market": m, "date": {"$lt": (date.fromisoformat(doc["date"]) - timedelta(days=6)).isoformat()}},
                                        NOID, sort=[("date", -1)])
        fresh = (today - date.fromisoformat(doc["date"])).days
        out.append({"market": m, "district": d, "modal": doc["modal_price"], "min": doc["min_price"], "max": doc["max_price"],
                    "date": doc["date"], "source_chip": source_chip(doc), "freshness_days": fresh, "stale": fresh > STALE_DAYS,
                    "wow_pct": round((doc["modal_price"] / prev["modal_price"] - 1) * 100, 1) if prev else None,
                    "distance_km": round(haversine_km(FARMER["lat"], FARMER["lon"], lat, lon), 1)})
    out.sort(key=lambda x: (x["district"] != district, x["distance_km"]))
    return {"commodity": commodity, "demo_today": today.isoformat(), "markets": out}


# ---------------- forecast ----------------
async def get_forecast(commodity, market):
    today = await demo_today()
    key = f"{commodity}|{market}|{today.isoformat()}"
    if key in FORECAST_MEM:
        return FORECAST_MEM[key]
    cached = await db.forecast_cache.find_one({"key": key}, NOID)
    if cached:
        FORECAST_MEM[key] = cached["forecast"]
        return cached["forecast"]
    sbm = await series_by_market(commodity)
    level = "local"
    target = market
    if market not in sbm:
        mi = market_info(commodity, market)
        dm = [m for m in sbm if market_info(commodity, m) and mi and market_info(commodity, m)["district"] == mi["district"]]
        if dm:
            target, level = dm[0], "district"
        elif sbm:
            target, level = max(sbm, key=lambda m: len(sbm[m])), "state"
        else:
            raise HTTPException(404, "no price history for commodity")
    vol = constants()["commodities"][commodity]["daily_volatility"]
    fc = await run_in_threadpool(fcst.full_forecast, sbm, target, vol)
    src_doc = await db.prices.find_one({"commodity": commodity, "market": target}, NOID, sort=[("date", -1)])
    fresh = (today - date.fromisoformat(fc["last_date"])).days
    fc.update({"commodity": commodity, "market": market, "series_market": target, "fallback_level": level,
               "source": src_doc["source"], "source_chip": source_chip(src_doc), "freshness_days": fresh, "stale": fresh > STALE_DAYS,
               "as_of": today.isoformat(), "computed_at": now_iso()})
    await db.forecast_cache.update_one({"key": key}, {"$set": {"key": key, "forecast": fc}}, upsert=True)
    FORECAST_MEM[key] = fc
    return fc


@api.get("/forecast")
async def forecast_endpoint(commodity: str = "Onion", market: str = "Lasalgaon"):
    return await get_forecast(commodity, market)


# ---------------- buyers ----------------
async def match_buyers(commodity, lat, lon, qty_q, grade, moisture_pct, ref_price, limit=5):
    pipeline = [{"$geoNear": {"near": {"type": "Point", "coordinates": [lon, lat]}, "distanceField": "distance_m", "spherical": True,
                              "maxDistance": 800000, "query": {"commodities": commodity}}}, {"$project": {"_id": 0}}]
    buyers = await db.buyers.aggregate(pipeline).to_list(200)
    lot = {"grade": grade, "moisture_pct": moisture_pct, "qty_q": qty_q}
    scored = []
    for b in buyers:
        s = score_buyer(b, lot, ref_price, b["distance_m"] / 1000)
        scored.append({"id": b["id"], "name": b["name"], "type": b["type"], "city": b["city"], "distance_km": s["distance_km"],
                       "offer_price": s["offer_price"], "payment_days": b["payment_days"], "rejection_prob": b["rejection_prob"],
                       "trust_score": b["trust_score"], "trust_band": b["trust_band"], "history": b["history"],
                       "match_score": s["score"], "match_components": s["components"], "accepted_grades": b["accepted_grades"],
                       "min_qty_q": b["min_qty_q"], "max_qty_q": b["max_qty_q"], "source": "simulated"})
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored[:limit]


@api.get("/buyers/match")
async def buyers_match(commodity: str = "Onion", qty_q: float = 300, grade: str = "A", moisture_pct: float = 12,
                       lat: float = FARMER["lat"], lon: float = FARMER["lon"], market: str = "Lasalgaon"):
    doc, _ = await latest_price(commodity, market)
    ref = doc["modal_price"] if doc else 1500
    return {"ref_price": ref, "weights": {"price": 30, "distance": 20, "quality": 15, "payment": 15, "trust": 10, "volume": 10},
            "buyers": await match_buyers(commodity, lat, lon, qty_q, grade, moisture_pct, ref)}


@api.get("/buyers")
async def buyers_list():
    return await db.buyers.find({}, NOID).to_list(200)


# ---------------- decision ----------------
class WhatIf(BaseModel):
    wait_days: Optional[int] = None
    price_shock_pct: float = 0.0
    transport_multiplier: float = 1.0
    split_ratio: float = 0.6


class DecideRequest(BaseModel):
    commodity: str = "Onion"
    qty_q: float = 300
    grade: str = "A"
    moisture_pct: float = 12
    market: str = "Lasalgaon"
    lat: float = FARMER["lat"]
    lon: float = FARMER["lon"]
    min_acceptable_price: Optional[float] = None
    whatif: WhatIf = Field(default_factory=WhatIf)


async def build_decision(req: DecideRequest):
    today = await demo_today()
    mi = market_info(req.commodity, req.market)
    if not mi:
        raise HTTPException(400, f"unknown market {req.market} for {req.commodity}")
    doc, level = await latest_price(req.commodity, req.market, mi["district"])
    if not doc:
        raise HTTPException(404, "no prices available")
    fc = await get_forecast(req.commodity, req.market)
    if fc["fallback_level"] != "local":
        level = fc["fallback_level"]
    fresh = (today - date.fromisoformat(doc["date"])).days
    buyers = await match_buyers(req.commodity, req.lat, req.lon, req.qty_q, req.grade, req.moisture_pct, doc["modal_price"])
    ctx = {"commodity": req.commodity, "qty_q": req.qty_q, "grade": req.grade, "moisture_pct": req.moisture_pct,
           "mandi": {"name": req.market, "modal_price": doc["modal_price"], "date": doc["date"], "source": source_chip(doc),
                     "distance_km": round(haversine_km(req.lat, req.lon, mi["lat"], mi["lon"]), 1)},
           "forecast": fc, "buyers": buyers, "stale": fresh > STALE_DAYS, "freshness_days": fresh, "fallback_level": level,
           "whatif": req.whatif.model_dump(), "min_acceptable_price": req.min_acceptable_price}
    result = decide(ctx)
    result["context"] = {"demo_today": today.isoformat(), "mandi": ctx["mandi"], "forecast_summary": {
        "p10": fc["p10"], "p50": fc["p50"], "p90": fc["p90"], "dates": fc["dates"], "backtest": fc["backtest"], "source_chip": fc["source_chip"]},
        "stale": ctx["stale"], "freshness_days": fresh, "fallback_level": level, "buyers": buyers, "request": req.model_dump()}
    return result


@api.post("/decide")
async def decide_endpoint(req: DecideRequest):
    t0 = datetime.now()
    res = await build_decision(req)
    res["latency_ms"] = round((datetime.now() - t0).total_seconds() * 1000)
    return res


# ---------------- lots / offers ----------------
class LotCreate(DecideRequest):
    photo_url: Optional[str] = None
    notes: Optional[str] = None


async def fire_offer(lot_id, buyer, ref_price, qty_q, index):
    lot = await db.lots.find_one({"id": lot_id}, NOID)
    if not lot or lot["status"] != "open":
        return
    rng = random.Random(f"{lot_id}{index}")
    gm = constants()["commodities"][lot["commodity"]]["grade_multiplier"].get(lot["grade"], 1.0)
    price = buyer["offer_price"] * gm * rng.uniform(0.985, 1.02)
    if index == 2:  # third offer deliberately low-ball to exercise the MAV warning path
        price = ref_price * gm * 0.88
    qty = min(qty_q, buyer["max_qty_q"])
    econ = compute_nrv(commodity=lot["commodity"], qty_q=qty, price_p50=price, price_p10=price * 0.99, distance_km=buyer["distance_km"],
                       channel="direct", payment_days=buyer["payment_days"], rejection_prob=buyer["rejection_prob"],
                       default_prob=constants()["risk"]["default_prob_by_trust"][buyer["trust_band"]])
    offer = {"id": str(uuid.uuid4()), "lot_id": lot_id, "buyer_id": buyer["id"], "buyer_name": buyer["name"], "buyer_type": buyer["type"],
             "price_per_q": round(price, 1), "qty_q": qty, "value": round(price * qty, 2), "payment_days": buyer["payment_days"],
             "distance_km": buyer["distance_km"], "trust_score": buyer["trust_score"], "trust_band": buyer["trust_band"],
             "match_score": buyer["match_score"], "nrv": econ["nrv"], "economics": econ, "status": "open",
             "below_mav": econ["nrv"] < lot["decision"]["min_acceptable_value"], "created_at": now_iso(),
             "valid_hours": 24, "source": "simulated buyer response"}
    await db.offers.insert_one(offer)
    offer.pop("_id", None)
    await audit("offer_received", lot_id, {"offer_id": offer["id"], "buyer": buyer["name"], "price_per_q": offer["price_per_q"], "below_mav": offer["below_mav"]}, actor="buyer-simulator")


@api.post("/lots")
async def create_lot(req: LotCreate):
    decision = await build_decision(req)
    lot = {"id": str(uuid.uuid4()), "farmer": FARMER, "commodity": req.commodity, "qty_q": req.qty_q, "grade": req.grade,
           "moisture_pct": req.moisture_pct, "market": req.market, "location": {"type": "Point", "coordinates": [req.lon, req.lat]},
           "photo_url": req.photo_url, "notes": req.notes, "status": "open", "created_at": now_iso(),
           "decision": {k: decision[k] for k in ("action", "action_label", "recommended", "pathways", "confidence", "why", "min_acceptable_value",
                                                  "baseline_mandi_nrv", "liquidity_impact", "alternatives")},
           "context": decision["context"], "offers_expected": 3}
    await db.lots.insert_one(lot)
    lot.pop("_id", None)
    await audit("lot_created", lot["id"], {"commodity": req.commodity, "qty_q": req.qty_q, "recommended": decision["action"],
                                           "min_acceptable_value": decision["min_acceptable_value"]})
    buyers = decision["context"]["buyers"][:3]
    ref = decision["context"]["mandi"]["modal_price"]
    delays = sorted(random.sample(range(10, 21), min(3, len(buyers))))
    for i, (b, d) in enumerate(zip(buyers, delays)):
        scheduler.add_job(fire_offer, "date", run_date=datetime.now(timezone.utc) + timedelta(seconds=d), args=[lot["id"], b, ref, req.qty_q, i],
                          id=f"offer-{lot['id']}-{i}", misfire_grace_time=120)
    await audit("buyer_simulator_scheduled", lot["id"], {"offers": len(buyers), "delays_s": delays}, actor="system")
    return lot


@api.get("/lots")
async def list_lots():
    return await db.lots.find({}, NOID).sort("created_at", -1).to_list(100)


@api.get("/lots/{lot_id}")
async def get_lot(lot_id: str):
    lot = await db.lots.find_one({"id": lot_id}, NOID)
    if not lot:
        raise HTTPException(404, "lot not found")
    lot["offers"] = await db.offers.find({"lot_id": lot_id}, NOID).sort("created_at", 1).to_list(50)
    lot["transaction"] = await db.transactions.find_one({"lot_id": lot_id}, NOID)
    return lot


class AcceptBody(BaseModel):
    override: bool = False


STAGES = ["accepted", "logistics_booked", "in_transit", "delivered", "payment_released", "closed"]


@api.post("/offers/{offer_id}/accept")
async def accept_offer(offer_id: str, body: AcceptBody):
    offer = await db.offers.find_one({"id": offer_id}, NOID)
    if not offer or offer["status"] != "open":
        raise HTTPException(404, "offer not open")
    lot = await db.lots.find_one({"id": offer["lot_id"]}, NOID)
    if lot["status"] != "open":
        raise HTTPException(409, "lot already closed")
    mav = lot["decision"]["min_acceptable_value"]
    if offer["below_mav"] and not body.override:
        await audit("accept_blocked_below_mav", lot["id"], {"offer_id": offer_id, "offer_nrv": offer["nrv"], "mav": mav})
        raise HTTPException(status_code=409, detail={"code": "BELOW_MAV", "offer_nrv": offer["nrv"], "min_acceptable_value": mav,
                                                     "shortfall": round(mav - offer["nrv"], 2),
                                                     "message": "Offer NRV is below your Minimum Acceptable Value (mandi-now NRV). Override to accept anyway."})
    tx = {"id": str(uuid.uuid4()), "lot_id": lot["id"], "offer_id": offer_id, "buyer_id": offer["buyer_id"], "buyer_name": offer["buyer_name"],
          "commodity": lot["commodity"], "qty_q": offer["qty_q"], "price_per_q": offer["price_per_q"], "agreed_value": offer["value"],
          "stage": "accepted", "stages": [{"stage": "accepted", "at": now_iso(), "note": f"Offer from {offer['buyer_name']} accepted" + (" (MAV override)" if offer["below_mav"] else "")}],
          "logistics": None, "payment": None, "outcome": None, "mav_override": bool(offer["below_mav"]), "created_at": now_iso(),
          "predicted": {"price_per_q": offer["price_per_q"], "nrv": offer["nrv"], "baseline_mandi_nrv": lot["decision"]["baseline_mandi_nrv"],
                        "recommended_pathway": lot["decision"]["action"], "recommended_nrv": lot["decision"]["recommended"]["economics"]["nrv"],
                        "forecast_p50_day1": lot["context"]["forecast_summary"]["p50"][0]}}
    await db.transactions.insert_one(tx)
    tx.pop("_id", None)
    await db.offers.update_one({"id": offer_id}, {"$set": {"status": "accepted"}})
    await db.offers.update_many({"lot_id": lot["id"], "id": {"$ne": offer_id}, "status": "open"}, {"$set": {"status": "declined"}})
    await db.lots.update_one({"id": lot["id"]}, {"$set": {"status": "sold", "transaction_id": tx["id"]}})
    await audit("offer_accepted", lot["id"], {"offer_id": offer_id, "buyer": offer["buyer_name"], "value": offer["value"], "override": body.override})
    return tx


@api.post("/transactions/{tx_id}/advance")
async def advance_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id}, NOID)
    if not tx:
        raise HTTPException(404, "transaction not found")
    i = STAGES.index(tx["stage"])
    if i >= len(STAGES) - 1:
        return tx
    nxt = STAGES[i + 1]
    offer = await db.offers.find_one({"id": tx["offer_id"]}, NOID)
    lot = await db.lots.find_one({"id": tx["lot_id"]}, NOID)
    upd = {"stage": nxt}
    note = ""
    if nxt == "logistics_booked":
        rate = await db.transport_rates.find_one({"band_km": "100-300" if offer["distance_km"] > 100 else "25-100" if offer["distance_km"] > 25 else "0-25"}, NOID)
        cost = transport_cost(tx["qty_q"], offer["distance_km"])
        upd["logistics"] = {"vehicle": rate["vehicle"], "transporter": "Nashik Goods Carriers (simulated)", "distance_km": offer["distance_km"],
                            "cost": cost, "eta_hours": round(2 + offer["distance_km"] / 35, 1), "booked_at": now_iso(), "source": "simulated"}
        note = f"{rate['vehicle']} booked, {offer['distance_km']} km, ₹{cost:,.0f}"
    elif nxt == "in_transit":
        note = "Vehicle dispatched from Niphad"
    elif nxt == "delivered":
        weighed = round(tx["qty_q"] * 0.992, 2)
        upd["delivery"] = {"weighed_qty_q": weighed, "shortfall_q": round(tx["qty_q"] - weighed, 2), "quality_accepted": True,
                           "invoice_value": round(weighed * tx["price_per_q"], 2), "delivered_at": now_iso()}
        note = f"Delivered: weighed {weighed} q, quality accepted"
    elif nxt == "payment_released":
        inv = tx["delivery"]["invoice_value"]
        upd["payment"] = {"method": "UPI escrow (simulated)", "amount": inv, "utr": f"SIM{uuid.uuid4().hex[:10].upper()}", "paid_at": now_iso(), "status": "settled"}
        note = f"₹{inv:,.0f} settled to farmer account"
    elif nxt == "closed":
        c = constants()["commodities"][tx["commodity"]]
        realised = tx["payment"]["amount"] - tx["logistics"]["cost"] - c["handling_per_q"] * tx["qty_q"]
        actual_doc, _ = await latest_price(tx["commodity"], lot["market"])
        upd["outcome"] = {"realised_nrv": round(realised, 2), "predicted_nrv": tx["predicted"]["nrv"],
                          "baseline_mandi_nrv": tx["predicted"]["baseline_mandi_nrv"], "delta_vs_baseline": round(realised - tx["predicted"]["baseline_mandi_nrv"], 2),
                          "forecast_p50_day1": tx["predicted"]["forecast_p50_day1"], "actual_mandi_modal": actual_doc["modal_price"],
                          "forecast_error_pct": round((tx["predicted"]["forecast_p50_day1"] / actual_doc["modal_price"] - 1) * 100, 2),
                          "retraining_note": "logged for retraining", "closed_at": now_iso()}
        note = "Outcome recorded in ledger"
        await db.lots.update_one({"id": tx["lot_id"]}, {"$set": {"status": "closed"}})
    stages = tx["stages"] + [{"stage": nxt, "at": now_iso(), "note": note}]
    upd["stages"] = stages
    await db.transactions.update_one({"id": tx_id}, {"$set": upd})
    await audit(f"tx_{nxt}", tx["lot_id"], {"transaction_id": tx_id, "note": note}, actor="system" if nxt != "closed" else "ledger")
    return await db.transactions.find_one({"id": tx_id}, NOID)


@api.get("/lots/{lot_id}/money-meter")
async def money_meter(lot_id: str):
    lot = await db.lots.find_one({"id": lot_id}, NOID)
    tx = await db.transactions.find_one({"lot_id": lot_id}, NOID)
    if not lot or not tx:
        raise HTTPException(404, "no transaction for lot")
    c = constants()["commodities"][tx["commodity"]]
    paid = (tx.get("payment") or {}).get("amount")
    logistics = (tx.get("logistics") or {}).get("cost", 0)
    handling = c["handling_per_q"] * tx["qty_q"]
    realised = round(paid - logistics - handling, 2) if paid is not None else None
    base = next(p for p in lot["decision"]["pathways"] if p["key"] == "mandi_now")["economics"]
    return {"lot_id": lot_id, "stage": tx["stage"], "complete": tx["stage"] in ("payment_released", "closed"),
            "baseline": {"label": "Mandi now (baseline)", "nrv": base["nrv"], "breakdown": {k: base[k] for k in ("gross", "transport", "handling", "commission", "risk_adjustment")}},
            "realised": {"label": f"Sold to {tx['buyer_name']}", "nrv": realised, "breakdown": {"gross_paid": paid, "transport": logistics, "handling": handling, "commission": 0}},
            "delta": round(realised - base["nrv"], 2) if realised is not None else None,
            "predicted_recommended_nrv": tx["predicted"]["recommended_nrv"], "recommended_pathway": tx["predicted"]["recommended_pathway"],
            "ledger": tx["stages"], "outcome": tx.get("outcome"), "source": "computed from transaction ledger"}


@api.get("/audit")
async def audit_list(lot_id: Optional[str] = None, limit: int = 100):
    q = {"lot_id": lot_id} if lot_id else {}
    return await db.audit_log.find(q, NOID).sort("ts", -1).to_list(limit)


# ---------------- market pulse / console ----------------
@api.get("/pulse")
async def pulse(commodity: str = "Onion"):
    today = await demo_today()
    start7 = (today - timedelta(days=7)).isoformat()
    start14 = (today - timedelta(days=14)).isoformat()
    arr = await db.arrivals.find({"commodity": commodity, "date": {"$gte": start14}}, NOID).to_list(20000)
    demand = {d["district"]: d["demand_q_per_day"] for d in await db.demand.find({"commodity": commodity}, NOID).to_list(200)}
    prices = await db.prices.find({"commodity": commodity, "date": {"$gte": start14}}, {"_id": 0, "district": 1, "date": 1, "modal_price": 1}).to_list(50000)
    by_d = {}
    for a in arr:
        b = by_d.setdefault(a["district"], {"recent": [], "prev": []})
        (b["recent"] if a["date"] >= start7 else b["prev"]).append(a["arrivals_q"])
    pr = {}
    for p in prices:
        b = pr.setdefault(p["district"], {"recent": [], "prev": []})
        (b["recent"] if p["date"] >= start7 else b["prev"]).append(p["modal_price"])
    out = []
    for dist, (lat, lon, state) in DISTRICTS.items():
        dem = demand.get(dist, 0)
        a = by_d.get(dist, {"recent": [], "prev": []})
        recent = sum(a["recent"]) / max(1, len(a["recent"])) if a["recent"] else 0
        ratio = recent / dem if dem else None
        status = "no-data" if ratio is None else ("surplus" if ratio > 1.15 else "shortage" if ratio < 0.85 else "balanced")
        pp = pr.get(dist)
        trend = None
        if pp and pp["recent"] and pp["prev"]:
            trend = round((sum(pp["recent"]) / len(pp["recent"])) / (sum(pp["prev"]) / len(pp["prev"])) * 100 - 100, 1)
        out.append({"district": dist, "state": state, "lat": lat, "lon": lon, "arrivals_q_per_day": round(recent), "demand_q_per_day": dem,
                    "ratio": round(ratio, 2) if ratio is not None else None, "status": status, "price_trend_pct": trend,
                    "avg_modal": round(sum(pp["recent"]) / len(pp["recent"])) if pp and pp["recent"] else None})
    return {"commodity": commodity, "demo_today": today.isoformat(), "districts": out, "source": "arrivals & demand simulated; prices from prices collection"}


@api.get("/console")
async def console():
    today = await demo_today()
    meta = await prices_meta()
    lots = await db.lots.count_documents({})
    closed = await db.transactions.count_documents({"stage": "closed"})
    txs = await db.transactions.find({"outcome": {"$ne": None}}, NOID).to_list(200)
    delta = sum(t["outcome"]["delta_vs_baseline"] for t in txs)
    backtests = []
    for com, mk in (("Onion", "Lasalgaon"), ("Onion", "Pimpalgaon Baswant"), ("Tomato", "Nashik"), ("Soyabean", "Latur")):
        key = f"{com}|{mk}|{today.isoformat()}"
        c = FORECAST_MEM.get(key) or ((await db.forecast_cache.find_one({"key": key}, NOID)) or {}).get("forecast")
        if c:
            backtests.append({"commodity": com, "market": mk, **c["backtest"], "history_days": c["history_days"], "source_chip": c["source_chip"]})
    arrivals = await db.arrivals.aggregate([{"$match": {"date": {"$gte": (today - timedelta(days=7)).isoformat()}}},
                                            {"$group": {"_id": {"c": "$commodity", "d": "$district"}, "q": {"$sum": "$arrivals_q"}}},
                                            {"$sort": {"q": -1}}, {"$limit": 12}]).to_list(12)
    return {"demo_today": today.isoformat(), "data": meta, "lots": lots, "closed_transactions": closed, "total_delta_vs_baseline": round(delta, 2),
            "backtests": backtests, "top_arrivals_7d": [{"commodity": a["_id"]["c"], "district": a["_id"]["d"], "arrivals_q": a["q"]} for a in arrivals],
            "buyers": await db.buyers.count_documents({}), "warehouses": await db.warehouses.find({}, NOID).to_list(20),
            "transport_rates": await db.transport_rates.find({}, NOID).to_list(20)}


@api.get("/warehouses")
async def warehouses():
    return await db.warehouses.find({}, NOID).to_list(20)


@api.get("/demo/state")
async def demo_state():
    today = await demo_today()
    onion, _ = await latest_price("Onion", "Lasalgaon")
    return {"demo_today": today.isoformat(), "pinned": bool(os.environ.get("DEMO_TODAY")), "farmer": FARMER,
            "price_source": onion["source"] if onion else None, "source_chip": source_chip(onion), "lots": await db.lots.count_documents({}),
            "forecast_ready": any(k.startswith("Onion|Lasalgaon") for k in FORECAST_MEM), "stale_threshold_days": STALE_DAYS}


@api.post("/demo/reset")
async def demo_reset():
    for col in ("lots", "offers", "transactions", "audit_log"):
        await db[col].delete_many({})
    await audit("demo_reset", None, {}, actor="system")
    return {"ok": True}


@api.post("/demo/refetch-agmarknet")
async def refetch():
    asyncio.get_event_loop().run_in_executor(None, lambda: asyncio.run(ingest_mod.run()))
    return {"ok": True, "note": "background fetch started; falls back to labelled synthetic if data.gov.in is rate-limited"}


@api.get("/")
async def root():
    return {"app": "KisanPulse", "status": "ok"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


async def warm_forecasts():
    for com, mk in (("Onion", "Lasalgaon"), ("Onion", "Pimpalgaon Baswant"), ("Tomato", "Nashik"), ("Soyabean", "Latur")):
        try:
            await get_forecast(com, mk)
        except Exception as e:
            logger.warning("warm forecast failed %s/%s: %s", com, mk, e)


async def ingest_job():
    try:
        await ingest_mod.run()
        FORECAST_MEM.clear()
        await db.forecast_cache.delete_many({})
        await warm_forecasts()
    except Exception as e:
        logger.warning("ingest job failed: %s", e)


@app.on_event("startup")
async def startup():
    if await db.prices.count_documents({}) == 0:
        await ingest_mod.run(synthetic_only=True)
    if await db.buyers.count_documents({}) == 0:
        await seed_mod.run(await demo_today())
    await db.lots.create_index("id")
    await db.offers.create_index([("lot_id", 1)])
    await db.audit_log.create_index([("lot_id", 1), ("ts", -1)])
    scheduler.add_job(ingest_job, "cron", hour=2, minute=30, id="agmarknet-daily", replace_existing=True)
    scheduler.start()
    asyncio.create_task(warm_forecasts())


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)
    client.close()
