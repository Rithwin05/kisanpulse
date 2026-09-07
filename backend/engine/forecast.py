import warnings
import numpy as np
import pandas as pd
import lightgbm as lgb
from statsmodels.tsa.holtwinters import ExponentialSmoothing

warnings.filterwarnings("ignore")

H = 7
LAGS = [1, 2, 3, 5, 7, 14, 21, 28]
QUANTILES = (0.1, 0.5, 0.9)
FEATURE_COLS = (["market", "weekday", "month", "doy_sin", "doy_cos", "level"]
                + [f"lag{L}" for L in LAGS] + ["rm7", "rm30", "rv7", "rv30", "h"])


def to_daily(records):
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    s = df.groupby("date")["modal_price"].mean().sort_index()
    idx = pd.date_range(s.index.min(), s.index.max(), freq="D")
    return s.reindex(idx).interpolate(limit_direction="both")


def seasonal_naive(s, h=H):
    last7 = s.values[-7:]
    return np.array([last7[i % len(last7)] for i in range(h)], dtype=float)


def ets_forecast(s, h=H):
    try:
        m = ExponentialSmoothing(s.values[-180:].astype(float), trend="add", damped_trend=True).fit(optimized=True)
        return np.maximum(m.forecast(h), 1.0)
    except Exception:
        return seasonal_naive(s, h)


def _features_at(s, t, market_id):
    v = s.values
    p = v[t]
    d = s.index[t]
    doy = d.dayofyear
    f = {"market": market_id, "weekday": d.weekday(), "month": d.month,
         "doy_sin": np.sin(2 * np.pi * doy / 365.25), "doy_cos": np.cos(2 * np.pi * doy / 365.25),
         "level": np.log(p)}
    for L in LAGS:
        f[f"lag{L}"] = np.log(v[t - L] / p)
    f["rm7"] = np.log(v[t - 6:t + 1].mean() / p)
    f["rm30"] = np.log(v[max(0, t - 29):t + 1].mean() / p)
    f["rv7"] = float(np.std(np.diff(np.log(v[t - 7:t + 1]))))
    f["rv30"] = float(np.std(np.diff(np.log(v[max(0, t - 30):t + 1]))))
    return f


def build_training(series_by_market):
    rows = []
    for mi, (mk, s) in enumerate(series_by_market.items()):
        v = s.values
        n = len(v)
        for t in range(max(LAGS), n - H):
            base = _features_at(s, t, mi)
            for h in range(1, H + 1):
                rows.append({**base, "h": h, "y": np.log(v[t + h] / v[t])})
    return pd.DataFrame(rows)


def train_models(df):
    X = df[FEATURE_COLS]
    y = df["y"]
    return {q: lgb.LGBMRegressor(objective="quantile", alpha=q, n_estimators=120, learning_rate=0.06,
                                 num_leaves=15, min_child_samples=20, verbose=-1).fit(X, y)
            for q in QUANTILES}


def predict(models, s, market_id, h=H):
    base = _features_at(s, len(s) - 1, market_id)
    p = s.values[-1]
    X = pd.DataFrame([{**base, "h": k} for k in range(1, h + 1)])[FEATURE_COLS]
    out = {q: p * np.exp(models[q].predict(X)) for q in QUANTILES}
    p50 = out[0.5]
    return np.minimum(out[0.1], p50), p50, np.maximum(out[0.9], p50)


def backtest(series_by_market, target, folds=4):
    s_full = series_by_market[target]
    n = len(s_full)
    err = {"lgbm": [], "ets": [], "snaive": [], "ensemble": []}
    cover = []
    for k in range(folds, 0, -1):
        cutoff = n - k * H
        end = s_full.index[cutoff - 1]
        trunc = {m: s.loc[:end] for m, s in series_by_market.items() if len(s.loc[:end]) > max(LAGS) + H + 10}
        if target not in trunc:
            continue
        models = train_models(build_training(trunc))
        p10, p50, p90 = predict(models, trunc[target], list(trunc).index(target))
        actual = s_full.values[cutoff:cutoff + H]
        ets = ets_forecast(trunc[target])
        err["lgbm"].append(np.abs(p50 - actual) / actual)
        err["ets"].append(np.abs(ets - actual) / actual)
        err["ensemble"].append(np.abs((p50 + ets) / 2 - actual) / actual)
        err["snaive"].append(np.abs(seasonal_naive(trunc[target]) - actual) / actual)
        cover.append(float(((actual >= p10) & (actual <= p90)).mean()))
    mape = {m: round(float(np.concatenate(v).mean() * 100), 2) for m, v in err.items() if v}
    champion = min(mape, key=mape.get) if mape else "snaive"
    return {"mape": mape, "champion": champion, "band_coverage_p10_p90": round(float(np.mean(cover)), 3) if cover else None,
            "folds": len(cover), "horizon": H}


def full_forecast(series_by_market, target, daily_vol=0.03):
    s = series_by_market[target]
    bt = backtest(series_by_market, target)
    models = train_models(build_training(series_by_market))
    p10, p50, p90 = predict(models, s, list(series_by_market).index(target))
    champ = bt["champion"]
    if champ == "ets":
        c50 = ets_forecast(s)
    elif champ == "ensemble":
        c50 = (p50 + ets_forecast(s)) / 2
    elif champ == "snaive":
        c50 = seasonal_naive(s)
    else:
        c50 = p50
    lo, hi = p50 - p10, p90 - p50
    p50 = c50
    p10, p90 = np.maximum(p50 - lo, 1.0), p50 + hi
    dates = [(s.index[-1] + pd.Timedelta(days=k)).strftime("%Y-%m-%d") for k in range(1, H + 1)]
    return {"dates": dates, "p10": [round(float(x), 1) for x in p10], "p50": [round(float(x), 1) for x in p50],
            "p90": [round(float(x), 1) for x in p90], "last_price": round(float(s.values[-1]), 1),
            "last_date": s.index[-1].strftime("%Y-%m-%d"), "history_days": int(len(s)), "backtest": bt}


def extend_band(fc, day, daily_vol):
    """P10/P50/P90 for `day` (1-based); beyond horizon, hold P50 flat and widen with sqrt(time)."""
    if day <= H:
        i = day - 1
        return fc["p10"][i], fc["p50"][i], fc["p90"][i]
    p50 = fc["p50"][-1]
    extra = daily_vol * np.sqrt(day - H) * p50 * 1.28
    return max(fc["p10"][-1] - extra, 1.0), p50, fc["p90"][-1] + extra
