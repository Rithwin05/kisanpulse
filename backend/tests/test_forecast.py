import sys, pathlib
import numpy as np
import pandas as pd
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from engine.forecast import to_daily, seasonal_naive, ets_forecast, full_forecast, extend_band, H


def _series(n=200, seed=1):
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2025-01-01", periods=n, freq="D")
    price = 1500 + 300 * np.sin(np.arange(n) / 30) + rng.normal(0, 30, n)
    return pd.Series(price, index=dates)


def test_to_daily_fills_gaps():
    recs = [{"date": "2026-01-01", "modal_price": 100}, {"date": "2026-01-04", "modal_price": 130}]
    s = to_daily(recs)
    assert len(s) == 4 and abs(s.iloc[1] - 110) < 1e-6


def test_baselines_shapes():
    s = _series()
    assert len(seasonal_naive(s)) == H
    assert len(ets_forecast(s)) == H


def test_full_forecast_bands_ordered():
    sbm = {"A": _series(seed=1), "B": _series(seed=2) * 1.05}
    fc = full_forecast(sbm, "A")
    assert len(fc["p50"]) == H
    for lo, mid, hi in zip(fc["p10"], fc["p50"], fc["p90"]):
        assert lo <= mid <= hi
    assert set(fc["backtest"]["mape"]) == {"lgbm", "ets", "snaive", "ensemble"}
    assert fc["backtest"]["champion"] in fc["backtest"]["mape"]


def test_extend_band_widens():
    fc = {"p10": [90] * H, "p50": [100] * H, "p90": [110] * H}
    p10a, _, p90a = extend_band(fc, 10, 0.03)
    p10b, _, p90b = extend_band(fc, 20, 0.03)
    assert p10b < p10a and p90b > p90a
