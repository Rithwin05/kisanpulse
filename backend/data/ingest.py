"""Agmarknet (data.gov.in) ingestion → MongoDB `prices`. Falls back to labelled synthetic-seasonal data.
Run: python -m data.ingest [--synthetic-only]
"""
import os
import sys
import time
import uuid
import math
import random
import logging
import asyncio
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

import requests
import numpy as np
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from .geo import MARKETS, SEASONAL, DISTRICTS

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
log = logging.getLogger("ingest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

RESOURCE = "35985678-0d79-46b4-9ed6-6f13308a1d24"
COMMODITIES = ["Onion", "Tomato", "Soyabean"]
MONTHS_BACK = 18


def _norm_key(d):
    return {k.lower().replace(" ", "_"): v for k, v in d.items()}


def _parse_date(s):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(s).strip(), fmt).date()
        except ValueError:
            continue
    return None


def fetch_agmarknet(commodity, api_key, state="Maharashtra", max_pages=60, page=1000):
    """Returns list of normalised records or raises on persistent failure."""
    out = []
    offset = 0
    session = requests.Session()
    for _ in range(max_pages):
        params = {"api-key": api_key, "format": "json", "limit": page, "offset": offset,
                  "filters[State.keyword]": state, "filters[Commodity]": commodity}
        for attempt in range(4):
            r = session.get(f"https://api.data.gov.in/resource/{RESOURCE}", params=params, timeout=60)
            if r.status_code == 429:
                wait = 20 * (attempt + 1)
                log.warning("429 rate limited, sleeping %ss", wait)
                time.sleep(wait)
                continue
            r.raise_for_status()
            break
        else:
            raise RuntimeError("data.gov.in rate limit persisted")
        js = r.json()
        recs = js.get("records", [])
        for rec in recs:
            n = _norm_key(rec)
            d = _parse_date(n.get("arrival_date"))
            try:
                modal = float(n.get("modal_price") or 0)
            except ValueError:
                modal = 0
            if not d or modal <= 0:
                continue
            out.append({
                "id": str(uuid.uuid4()), "commodity": commodity, "state": n.get("state", state),
                "district": (n.get("district") or "").strip(), "market": (n.get("market") or "").strip(),
                "variety": n.get("variety"), "grade": n.get("grade"), "date": d.isoformat(),
                "min_price": float(n.get("min_price") or modal), "max_price": float(n.get("max_price") or modal),
                "modal_price": modal, "source": "agmarknet", "fetched_at": datetime.now(timezone.utc).isoformat(),
                "anomaly": False,
            })
        total = int(js.get("total", 0))
        offset += page
        log.info("%s: fetched %d/%d", commodity, min(offset, total), total)
        if offset >= total or not recs:
            break
    return out


def synthetic_prices(commodity, end: date, months=MONTHS_BACK, seed=7):
    rng = np.random.default_rng(seed + len(commodity))
    base, season = SEASONAL[commodity]
    start = end - timedelta(days=int(months * 30.4))
    days = (end - start).days + 1
    out = []
    # year-level shocks and AR(1) noise shared across markets, market-specific jitter
    ar = 0.0
    shared = []
    for i in range(days):
        ar = 0.92 * ar + rng.normal(0, 0.035)
        shared.append(ar)
    for (market, district, lat, lon, idx) in MARKETS[commodity]:
        jitter = 0.0
        for i in range(days):
            d = start + timedelta(days=i)
            if d.weekday() == 6:  # mandis mostly closed Sunday
                continue
            jitter = 0.7 * jitter + rng.normal(0, 0.02)
            m = d.month - 1
            frac = d.day / 31
            si = season[m] * (1 - frac) + season[(m + 1) % 12] * frac
            year_factor = 1.0 + 0.12 * math.sin(2 * math.pi * (d.year - 2024) / 3)
            price = base * si * idx * year_factor * math.exp(shared[i] + jitter)
            out.append({
                "id": str(uuid.uuid4()), "commodity": commodity, "state": DISTRICTS[district][2], "district": district,
                "market": market, "variety": "Other", "grade": "FAQ", "date": d.isoformat(),
                "min_price": round(price * 0.82, 0), "max_price": round(price * 1.12, 0), "modal_price": round(price, 0),
                "source": "synthetic-seasonal", "fetched_at": datetime.now(timezone.utc).isoformat(), "anomaly": False,
            })
    return out


def flag_anomalies(records):
    """>3σ daily log-return per market → anomaly=True (excluded from training)."""
    by = {}
    for r in records:
        by.setdefault((r["commodity"], r["market"]), []).append(r)
    n_flag = 0
    for recs in by.values():
        recs.sort(key=lambda r: r["date"])
        if len(recs) < 30:
            continue
        p = np.array([r["modal_price"] for r in recs], dtype=float)
        lr = np.diff(np.log(p))
        sd = lr.std() or 1e-6
        for i, v in enumerate(lr):
            if abs(v - lr.mean()) > 3 * sd:
                recs[i + 1]["anomaly"] = True
                n_flag += 1
    return n_flag


async def run(synthetic_only=False):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    api_key = os.environ.get("DATA_GOV_API_KEY", "")
    end = date.today()
    for com in COMMODITIES:
        recs = []
        if not synthetic_only and api_key:
            try:
                recs = fetch_agmarknet(com, api_key)
                recs = [r for r in recs if date.fromisoformat(r["date"]) >= end - timedelta(days=MONTHS_BACK * 31)]
            except Exception as e:
                log.error("Agmarknet fetch failed for %s: %s", com, e)
        if recs:
            flag_anomalies(recs)
            await db.prices.delete_many({"commodity": com})
            await db.prices.insert_many(recs)
            log.info("%s: stored %d real Agmarknet records", com, len(recs))
        else:
            existing_real = await db.prices.count_documents({"commodity": com, "source": "agmarknet"})
            if existing_real:
                log.info("%s: keeping %d existing real records", com, existing_real)
                continue
            syn = synthetic_prices(com, end)
            flag_anomalies(syn)
            await db.prices.delete_many({"commodity": com})
            await db.prices.insert_many(syn)
            log.info("%s: stored %d SYNTHETIC-SEASONAL records (labelled)", com, len(syn))
    await db.prices.create_index([("commodity", 1), ("market", 1), ("date", 1)])
    await db.prices.create_index([("commodity", 1), ("district", 1), ("date", 1)])
    await db.meta.update_one({"key": "ingest"}, {"$set": {"key": "ingest", "last_run": datetime.now(timezone.utc).isoformat()}}, upsert=True)


if __name__ == "__main__":
    asyncio.run(run(synthetic_only="--synthetic-only" in sys.argv))
