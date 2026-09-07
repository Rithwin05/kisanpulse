"""Seed synthetic buyers, warehouses, transport rates, demand and arrivals. All labelled `simulated`."""
import os
import uuid
import random
import asyncio
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from .geo import DISTRICTS, SUPPLY_SHARE
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.match import trust_score, trust_band  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BUYER_TYPES = [
    ("trader", 0.00, 3, ["A", "B", "C"], 14),
    ("processor", 0.04, 7, ["A", "B"], 13),
    ("retail_chain", 0.09, 10, ["A"], 12),
    ("exporter", 0.12, 15, ["A"], 11),
    ("fpo", 0.03, 7, ["A", "B"], 14),
    ("hotel_supply", 0.06, 5, ["A", "B"], 13),
]
NAMES = ["Sahyadri Farms", "Godavari Agro Traders", "Deccan Fresh Retail", "Konkan Exports Pvt Ltd", "Niphad Farmer Producer Co.",
         "Mumbai HoReCa Supply", "Pune Agro Processors", "Lasalgaon Onion Merchants", "Nashik Valley Foods", "WayCool Maharashtra",
         "Ninjacart Pune Hub", "BigBasket Nashik DC", "Reliance Fresh Sourcing", "Jain Irrigation Foods", "Sula Kitchen Supplies",
         "Suryoday FPC", "Shri Ganesh Traders", "Marathwada Dehydrates", "Sangamner Tomato Pulp", "Nagpur Wholesale Mart",
         "Solapur Agri Link", "Surat Onion Exporters", "Hyderabad Mandi Traders", "Kolhapur Sahakari Bhandar", "Ahmednagar Agro Pool",
         "DeHaat Nashik", "Aurangabad Foods Ltd", "Thane Retail Chain", "Vashi APMC Wholesaler", "Rahuri Krishi FPC",
         "Yeola Bulk Buyers", "Malegaon Traders", "Satara Cold Chain", "Dhule Agro Traders", "Latur Soya Crushers",
         "Akola Oil Mills", "Amravati Agro Industries", "Washim Soya Traders", "Vidarbha Foods", "Beed Krishi Udyog"]
CITIES = ["Nashik", "Pune", "Mumbai", "Thane", "Ahmednagar", "Aurangabad", "Solapur", "Nagpur", "Kolhapur", "Latur", "Akola", "Amravati",
          "Washim", "Dhule", "Satara", "Beed", "Hyderabad", "Nalgonda"]


def make_buyers(seed=11):
    rng = random.Random(seed)
    out = []
    for i, name in enumerate(NAMES):
        btype, prem, pay, grades, maxm = BUYER_TYPES[i % len(BUYER_TYPES)]
        if "Soya" in name or "Oil" in name or "Vidarbha" in name:
            city = rng.choice(["Latur", "Akola", "Amravati", "Washim", "Nagpur"])
            commodities = ["Soyabean"]
        elif "Tomato" in name or "Pulp" in name:
            city = rng.choice(["Ahmednagar", "Pune", "Nashik"])
            commodities = ["Tomato"]
        else:
            city = CITIES[i % len(CITIES)] if i % 3 else rng.choice(["Nashik", "Pune", "Mumbai", "Ahmednagar"])
            commodities = ["Onion"] + (["Tomato"] if i % 2 == 0 else [])
        lat, lon, _ = DISTRICTS[city]
        history = {"deals": rng.randint(4, 80), "on_time_rate": round(rng.uniform(0.55, 1.0), 2),
                   "rejection_rate": round(rng.uniform(0.0, 0.2), 2)}
        ts = trust_score(history)
        out.append({
            "id": str(uuid.uuid4()), "name": name, "type": btype, "city": city,
            "location": {"type": "Point", "coordinates": [lon + rng.uniform(-0.15, 0.15), lat + rng.uniform(-0.15, 0.15)]},
            "commodities": commodities, "accepted_grades": grades, "max_moisture_pct": maxm,
            "min_qty_q": rng.choice([20, 50, 100]), "max_qty_q": rng.choice([300, 500, 1000, 2000]),
            "price_premium_pct": round(prem + rng.uniform(-0.03, 0.03), 3), "payment_days": pay,
            "rejection_prob": round(history["rejection_rate"] * 0.5 + 0.01, 3),
            "history": history, "trust_score": ts, "trust_band": trust_band(ts), "source": "simulated",
        })
    return out


WAREHOUSES = [
    ("Lasalgaon Onion Chawl (MSAMB)", "Nashik", 20.14, 74.26, "ventilated_chawl", 5000, 1.5, ["Onion"]),
    ("Pimpalgaon Cold Store", "Nashik", 20.16, 73.99, "cold_storage", 2000, 7.0, ["Tomato", "Onion"]),
    ("Niphad FPO Godown", "Nashik", 20.08, 74.11, "ventilated_chawl", 1200, 1.2, ["Onion"]),
    ("MSWC Warehouse Rahuri", "Ahmednagar", 19.39, 74.65, "dry_warehouse", 8000, 0.6, ["Soyabean", "Onion"]),
    ("Latur MSWC Godown", "Latur", 18.40, 76.57, "dry_warehouse", 10000, 0.6, ["Soyabean"]),
    ("Pune Market Yard Cold Chain", "Pune", 18.50, 73.87, "cold_storage", 3000, 7.5, ["Tomato", "Onion"]),
]

TRANSPORT_RATES = [
    {"band_km": "0-25", "vehicle": "Tata Ace (1 t)", "rate_per_q_km": 1.4, "fixed": 300},
    {"band_km": "25-100", "vehicle": "Tata 407 (3 t)", "rate_per_q_km": 1.0, "fixed": 400},
    {"band_km": "100-300", "vehicle": "Tata 1109 (10 t)", "rate_per_q_km": 0.85, "fixed": 500},
    {"band_km": "300+", "vehicle": "Multi-axle (25 t)", "rate_per_q_km": 0.6, "fixed": 900},
]


def make_arrivals(end: date, days=45, seed=3):
    rng = random.Random(seed)
    out = []
    state_daily = {"Onion": 42000, "Tomato": 18000, "Soyabean": 30000}
    for com, shares in SUPPLY_SHARE.items():
        for i in range(days):
            d = end - timedelta(days=days - 1 - i)
            if d.weekday() == 6:
                continue
            for dist, sh in shares.items():
                base = state_daily[com] * sh
                trend = 1 + 0.25 * (i / days) if dist in ("Nashik", "Ahmednagar") and com == "Onion" else 1.0
                out.append({"id": str(uuid.uuid4()), "commodity": com, "district": dist, "date": d.isoformat(),
                            "arrivals_q": round(base * trend * rng.uniform(0.7, 1.3)), "source": "simulated"})
    return out


def make_demand():
    out = []
    state_daily = {"Onion": 42000, "Tomato": 18000, "Soyabean": 30000}
    pop_w = {"Mumbai": 0.16, "Thane": 0.09, "Pune": 0.10, "Nagpur": 0.05, "Nashik": 0.05, "Aurangabad": 0.03, "Solapur": 0.035,
             "Kolhapur": 0.03, "Ahmednagar": 0.035, "Palghar": 0.025, "Raigad": 0.02, "Latur": 0.02, "Amravati": 0.025,
             "Akola": 0.015, "Jalgaon": 0.035, "Dhule": 0.017, "Sangli": 0.023, "Satara": 0.025, "Beed": 0.02, "Nanded": 0.027,
             "Yavatmal": 0.022, "Buldhana": 0.021, "Chandrapur": 0.018, "Wardha": 0.011, "Osmanabad": 0.014, "Jalna": 0.016,
             "Parbhani": 0.015, "Hingoli": 0.01, "Washim": 0.01, "Gondia": 0.011, "Bhandara": 0.01, "Gadchiroli": 0.009,
             "Nandurbar": 0.014, "Ratnagiri": 0.013, "Sindhudurg": 0.007, "Nalgonda": 0.02, "Hyderabad": 0.08, "Warangal": 0.02}
    for com, total in state_daily.items():
        for dist, w in pop_w.items():
            out.append({"id": str(uuid.uuid4()), "commodity": com, "district": dist, "demand_q_per_day": round(total * w), "source": "simulated"})
    return out


async def run(end: date = None):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    end = end or date.today()
    await db.buyers.delete_many({})
    await db.buyers.insert_many(make_buyers())
    await db.buyers.create_index([("location", "2dsphere")])
    await db.warehouses.delete_many({})
    await db.warehouses.insert_many([{"id": str(uuid.uuid4()), "name": n, "district": d, "location": {"type": "Point", "coordinates": [lon, lat]},
                                      "kind": k, "capacity_q": cap, "rate_per_q_per_day": rate, "commodities": coms, "source": "simulated"}
                                     for (n, d, lat, lon, k, cap, rate, coms) in WAREHOUSES])
    await db.warehouses.create_index([("location", "2dsphere")])
    await db.transport_rates.delete_many({})
    await db.transport_rates.insert_many([{"id": str(uuid.uuid4()), **r, "source": "simulated (CIRT-indexed)"} for r in TRANSPORT_RATES])
    await db.arrivals.delete_many({})
    await db.arrivals.insert_many(make_arrivals(end))
    await db.demand.delete_many({})
    await db.demand.insert_many(make_demand())
    print("seeded buyers/warehouses/transport/arrivals/demand")


if __name__ == "__main__":
    asyncio.run(run())
