import math

WEIGHTS = {"price": 0.30, "distance": 0.20, "quality": 0.15, "payment": 0.15, "trust": 0.10, "volume": 0.10}


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def trust_score(history):
    """Rule-based over seeded history: 60% on-time payment, 25% low rejection, 15% deal depth."""
    s = 60 * history["on_time_rate"] + 25 * (1 - history["rejection_rate"]) + 15 * min(history["deals"] / 50, 1)
    return round(s)


def trust_band(score):
    return "high" if score >= 80 else "medium" if score >= 60 else "low"


def _clamp(x):
    return max(0.0, min(1.0, x))


def buyer_price(buyer, ref_price, grade_mult=1.0):
    return round(ref_price * (1 + buyer["price_premium_pct"]) * grade_mult, 2)


def score_buyer(buyer, lot, ref_price, distance_km):
    bp = buyer_price(buyer, ref_price)
    s = {
        "price": _clamp((bp / ref_price - 0.90) / 0.25),
        "distance": _clamp(1 - distance_km / 300),
        "quality": (1.0 if lot["grade"] in buyer["accepted_grades"] else 0.3)
                   * (1.0 if lot.get("moisture_pct", 0) <= buyer.get("max_moisture_pct", 100) else 0.5),
        "payment": _clamp(1 - buyer["payment_days"] / 30),
        "trust": buyer["trust_score"] / 100,
        "volume": 1.0 if buyer["min_qty_q"] <= lot["qty_q"] <= buyer["max_qty_q"]
                  else (0.4 if lot["qty_q"] < buyer["min_qty_q"] else 0.7),
    }
    total = sum(WEIGHTS[k] * v for k, v in s.items()) * 100
    return {"score": round(total, 1), "components": {k: round(v * 100) for k, v in s.items()},
            "weights": WEIGHTS, "offer_price": bp, "distance_km": round(distance_km, 1)}
