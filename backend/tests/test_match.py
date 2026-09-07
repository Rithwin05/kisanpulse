import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from engine.match import score_buyer, trust_score, haversine_km, WEIGHTS


def _buyer(**o):
    b = {"price_premium_pct": 0.05, "accepted_grades": ["A", "B"], "max_moisture_pct": 13, "payment_days": 5,
         "trust_score": 85, "min_qty_q": 50, "max_qty_q": 500}
    b.update(o)
    return b


LOT = {"grade": "A", "moisture_pct": 12, "qty_q": 300}


def test_weights_sum_to_one():
    assert abs(sum(WEIGHTS.values()) - 1) < 1e-9


def test_haversine_lasalgaon_pune():
    assert 170 < haversine_km(20.14, 74.24, 18.52, 73.86) < 200


def test_higher_price_scores_higher():
    lo = score_buyer(_buyer(price_premium_pct=0.0), LOT, 2000, 50)["score"]
    hi = score_buyer(_buyer(price_premium_pct=0.10), LOT, 2000, 50)["score"]
    assert hi > lo


def test_grade_mismatch_penalised():
    ok = score_buyer(_buyer(), LOT, 2000, 50)["score"]
    bad = score_buyer(_buyer(accepted_grades=["A"]), {**LOT, "grade": "C"}, 2000, 50)["score"]
    assert bad < ok


def test_trust_score_rule():
    assert trust_score({"on_time_rate": 1.0, "rejection_rate": 0.0, "deals": 50}) == 100
    assert trust_score({"on_time_rate": 0.5, "rejection_rate": 0.2, "deals": 5}) < 60
