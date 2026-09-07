import math
import pathlib
import yaml

_C = yaml.safe_load(open(pathlib.Path(__file__).parent / "constants.yaml"))


def constants():
    return _C


def transport_cost(qty_q, distance_km, multiplier=1.0, shared=False):
    t = _C["transport"]
    trips = max(1, math.ceil(qty_q / t["truck_capacity_q"]))
    cost = (distance_km * t["rate_per_q_km"] * qty_q + t["fixed_per_trip"] * trips) * multiplier
    if shared:
        cost *= t["fpo_share_factor"]
    return round(cost, 2)


def compute_nrv(*, commodity, qty_q, price_p50, price_p10, distance_km, channel, days=0,
                payment_days=1, rejection_prob=0.02, default_prob=0.0,
                transport_multiplier=1.0, shared_transport=False, storage=False):
    c = _C["commodities"][commodity]
    r = _C["risk"]
    gross = qty_q * price_p50
    transport = transport_cost(qty_q, distance_km, transport_multiplier, shared_transport)
    handling = c["handling_per_q"] * qty_q
    commission = gross * c["commission"][channel]
    storage_cost = c["storage_per_q_per_day"] * qty_q * days if storage and days > 0 else 0.0
    spoilage = gross * (1 - (1 - c["spoilage_pct_per_day"]) ** days) if days > 0 else 0.0
    payment_risk = gross * (r["opportunity_cost_daily"] * payment_days + default_prob)
    rejection_risk = gross * rejection_prob * r["rejection_loss_fraction"]
    volatility_risk = r["volatility_lambda"] * qty_q * max(0.0, price_p50 - price_p10)
    risk_adjustment = payment_risk + rejection_risk + volatility_risk
    nrv = gross - transport - handling - commission - storage_cost - spoilage - risk_adjustment
    return {
        "gross": round(gross, 2),
        "transport": round(transport, 2),
        "handling": round(handling, 2),
        "commission": round(commission, 2),
        "storage": round(storage_cost, 2),
        "spoilage": round(spoilage, 2),
        "risk_adjustment": round(risk_adjustment, 2),
        "risk_breakdown": {
            "payment": round(payment_risk, 2),
            "rejection": round(rejection_risk, 2),
            "volatility": round(volatility_risk, 2),
        },
        "nrv": round(nrv, 2),
        "nrv_per_q": round(nrv / qty_q, 2) if qty_q else 0.0,
        "inputs": {
            "qty_q": qty_q, "price_p50": round(price_p50, 2), "price_p10": round(price_p10, 2),
            "distance_km": distance_km, "channel": channel, "days": days,
            "payment_days": payment_days, "rejection_prob": rejection_prob,
        },
    }
