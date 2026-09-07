import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from engine.nrv import compute_nrv, transport_cost, constants


def test_transport_trips_and_shared():
    c = constants()["transport"]
    one = transport_cost(100, 50)
    assert one == round(50 * c["rate_per_q_km"] * 100 + c["fixed_per_trip"], 2)
    two = transport_cost(150, 50)
    assert two - one == c["fixed_per_trip"] + 50 * c["rate_per_q_km"] * 50
    assert transport_cost(100, 50, shared=True) < one


def test_nrv_identity():
    r = compute_nrv(commodity="Onion", qty_q=300, price_p50=2000, price_p10=1800, distance_km=30, channel="mandi")
    total_deductions = r["transport"] + r["handling"] + r["commission"] + r["storage"] + r["spoilage"] + r["risk_adjustment"]
    assert abs(r["gross"] - total_deductions - r["nrv"]) < 0.05
    assert r["gross"] == 600000
    assert r["commission"] == 600000 * 0.04


def test_storage_adds_spoilage_and_storage():
    a = compute_nrv(commodity="Onion", qty_q=100, price_p50=2000, price_p10=2000, distance_km=10, channel="mandi")
    b = compute_nrv(commodity="Onion", qty_q=100, price_p50=2000, price_p10=2000, distance_km=10, channel="mandi", days=10, storage=True)
    assert b["storage"] == 1.5 * 100 * 10
    assert b["spoilage"] > 0 and a["spoilage"] == 0
    assert b["nrv"] < a["nrv"]


def test_volatility_penalty_scales_with_band():
    narrow = compute_nrv(commodity="Onion", qty_q=100, price_p50=2000, price_p10=1950, distance_km=10, channel="direct")
    wide = compute_nrv(commodity="Onion", qty_q=100, price_p50=2000, price_p10=1600, distance_km=10, channel="direct")
    assert wide["risk_breakdown"]["volatility"] > narrow["risk_breakdown"]["volatility"]
    assert wide["nrv"] < narrow["nrv"]


def test_tomato_spoils_faster_than_onion():
    o = compute_nrv(commodity="Onion", qty_q=100, price_p50=2000, price_p10=2000, distance_km=10, channel="mandi", days=5, storage=True)
    t = compute_nrv(commodity="Tomato", qty_q=100, price_p50=2000, price_p10=2000, distance_km=10, channel="mandi", days=5, storage=True)
    assert t["spoilage"] > o["spoilage"]
