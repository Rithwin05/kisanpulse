import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from engine.decide import decide


def _ctx(**over):
    fc = {"dates": [f"2026-06-{d:02d}" for d in range(2, 9)], "p10": [1850] * 7, "p50": [2000 + 20 * i for i in range(7)],
          "p90": [2200] * 7, "backtest": {"champion": "lgbm", "mape": {"lgbm": 5.1, "ets": 6.3, "snaive": 8.0},
                                          "band_coverage_p10_p90": 0.8, "folds": 4, "horizon": 7}}
    ctx = {"commodity": "Onion", "qty_q": 300, "grade": "A", "moisture_pct": 12,
           "mandi": {"name": "Lasalgaon", "modal_price": 2000, "distance_km": 25, "source": "Agmarknet 2026-06-01"},
           "forecast": fc, "buyers": [{"name": "Sahyadri Farms", "type": "processor", "offer_price": 2120, "distance_km": 40,
                                       "payment_days": 5, "rejection_prob": 0.03, "trust_score": 86, "trust_band": "high",
                                       "match_score": 81.2}],
           "stale": False, "freshness_days": 0, "fallback_level": "local", "whatif": {}}
    ctx.update(over)
    return ctx


def test_returns_five_pathways_sorted():
    r = decide(_ctx())
    assert len(r["pathways"]) == 5
    nrvs = [p["economics"]["nrv"] for p in r["pathways"]]
    assert nrvs == sorted(nrvs, reverse=True)
    assert r["action"] == r["pathways"][0]["key"]
    assert {"action", "confidence", "why", "alternatives", "liquidity_impact", "min_acceptable_value"} <= set(r)


def test_price_shock_reduces_all_nrv():
    base = decide(_ctx())
    shocked = decide(_ctx(whatif={"price_shock_pct": -10}))
    for k in ("mandi_now", "direct_buyer", "store"):
        b = next(p for p in base["pathways"] if p["key"] == k)["economics"]["nrv"]
        s = next(p for p in shocked["pathways"] if p["key"] == k)["economics"]["nrv"]
        assert s < b


def test_wait_days_override_respected():
    r = decide(_ctx(whatif={"wait_days": 3}))
    st = next(p for p in r["pathways"] if p["key"] == "store")
    assert st["wait_days"] == 3


def test_fallback_caps_confidence():
    r = decide(_ctx(fallback_level="state"))
    assert r["confidence"]["score"] <= 40
    assert any(p["key"] == "mandi_now" for p in r["pathways"])


def test_stale_penalty():
    fresh = decide(_ctx())["confidence"]["score"]
    stale = decide(_ctx(stale=True, freshness_days=5))["confidence"]["score"]
    assert stale < fresh


def test_no_buyers_still_decides():
    r = decide(_ctx(buyers=[]))
    assert len(r["pathways"]) == 5
