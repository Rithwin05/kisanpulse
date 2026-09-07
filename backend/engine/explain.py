def inr(x):
    return f"₹{x:,.0f}"


def explain(ctx, result):
    """Template-only evidence bullets. Every number here comes from the engine output."""
    mandi = ctx["mandi"]
    fc = ctx["forecast"]
    top = result["recommended"]
    by = {p["key"]: p for p in result["pathways"]}
    bullets = []
    src = mandi["source"]
    bullets.append({"text": f"{mandi['name']} modal price is {inr(mandi['modal_price'])}/q; 7-day P50 forecast {inr(fc['p50'][-1])}/q "
                            f"(P10 {inr(fc['p10'][-1])} – P90 {inr(fc['p90'][-1])}).", "source": src})
    bt = fc["backtest"]
    bullets.append({"text": f"Forecast model: {bt['champion']} chosen by backtest MAPE {bt['mape'].get(bt['champion'], 0):.1f}% "
                            f"over {bt['folds']} folds × {bt['horizon']} days; P10–P90 band covered {round((bt.get('band_coverage_p10_p90') or 0)*100)}% of actuals.",
                    "source": "backtest"})
    st = by.get("store")
    if st:
        e = st["economics"]
        bullets.append({"text": f"Storing {st['wait_days']} days costs {inr(e['storage'])} storage + {inr(e['spoilage'])} expected spoilage "
                                f"+ {inr(e['risk_breakdown']['volatility'])} volatility penalty against a price move to {inr(st['price_per_q'])}/q.",
                        "source": "NRV engine"})
    db = by.get("direct_buyer")
    if db and db.get("buyer"):
        b = db["buyer"]
        bullets.append({"text": f"Best-matched buyer {b['name']} ({b['type']}) pays {inr(db['price_per_q'])}/q, {b['distance_km']} km away, "
                                f"{b['payment_days']}-day payment, trust {b['trust_score']}/100 (simulated history), match score {b['match_score']}.",
                        "source": "simulated buyer"})
    mn = by["mandi_now"]["economics"]
    bullets.append({"text": f"Mandi-now deductions: transport {inr(mn['transport'])}, commission {inr(mn['commission'])}, handling {inr(mn['handling'])}, "
                            f"risk {inr(mn['risk_adjustment'])} → NRV {inr(mn['nrv'])}.", "source": "NRV engine"})
    if len(result["alternatives"]):
        alt = result["alternatives"][0]
        bullets.append({"text": f"'{top['label']}' beats '{alt['label']}' by {inr(-alt['delta_vs_best'])} ({result['margin_pct']:.1f}%).",
                        "source": "decision engine"})
    if ctx.get("stale"):
        bullets.append({"text": f"Warning: latest price record is {ctx['freshness_days']} days old; confidence penalised.", "source": src})
    if ctx.get("fallback_level", "local") != "local":
        bullets.append({"text": f"No local mandi history — used {ctx['fallback_level']} prices; confidence capped at 40%.", "source": "fallback"})
    return bullets
