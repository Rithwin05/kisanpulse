from .nrv import compute_nrv, constants
from .forecast import extend_band
from .explain import explain

PATHWAY_LABELS = {
    "mandi_now": "Sell at mandi now",
    "direct_buyer": "Sell to direct buyer",
    "fpo_aggregate": "Pool with FPO",
    "store": "Store & sell later",
    "split": "Split lot",
}


def _shock(p, pct):
    return p * (1 + pct / 100.0)


def decide(ctx):
    C = constants()
    com = ctx["commodity"]
    cc = C["commodities"][com]
    pd_ = C["pathway_defaults"]
    w = ctx.get("whatif") or {}
    shock = w.get("price_shock_pct") or 0.0
    tm = w.get("transport_multiplier") or 1.0
    split_ratio = w.get("split_ratio") if w.get("split_ratio") is not None else 0.6
    qty = ctx["qty_q"]
    gm = cc["grade_multiplier"].get(ctx.get("grade", "A"), 1.0)
    mandi = ctx["mandi"]
    fc = ctx["forecast"]
    modal = _shock(mandi["modal_price"], shock) * gm
    vol = cc["daily_volatility"]
    pathways = []

    # 1. Mandi now
    m = compute_nrv(commodity=com, qty_q=qty, price_p50=modal, price_p10=modal * (1 - vol),
                    distance_km=mandi["distance_km"], channel="mandi", days=0,
                    payment_days=pd_["mandi"]["payment_days"], rejection_prob=pd_["mandi"]["rejection_prob"],
                    transport_multiplier=tm)
    pathways.append({"key": "mandi_now", "label": PATHWAY_LABELS["mandi_now"], "price_per_q": round(modal, 1),
                     "days_to_cash": 1, "risk": "low", "counterparty": mandi["name"], "economics": m,
                     "source": mandi["source"]})

    # 2. Direct buyer
    buyers = ctx.get("buyers") or []
    if buyers:
        b = buyers[0]
        price = _shock(b["offer_price"], shock) * gm
        band = C["risk"]["default_prob_by_trust"][b["trust_band"]]
        d = compute_nrv(commodity=com, qty_q=qty, price_p50=price, price_p10=price * (1 - vol * 0.5),
                        distance_km=b["distance_km"], channel="direct", days=0,
                        payment_days=b["payment_days"], rejection_prob=b["rejection_prob"], default_prob=band,
                        transport_multiplier=tm)
        pathways.append({"key": "direct_buyer", "label": PATHWAY_LABELS["direct_buyer"], "price_per_q": round(price, 1),
                         "days_to_cash": b["payment_days"], "risk": "medium" if b["trust_band"] != "high" else "low",
                         "counterparty": b["name"], "buyer": b, "economics": d, "source": "simulated buyer"})
    else:
        f = pd_["direct_fallback"]
        price = modal * (1 + f["price_premium"])
        d = compute_nrv(commodity=com, qty_q=qty, price_p50=price, price_p10=price * (1 - vol * 0.5),
                        distance_km=f["distance_km"], channel="direct", payment_days=f["payment_days"],
                        rejection_prob=f["rejection_prob"], default_prob=0.02, transport_multiplier=tm)
        pathways.append({"key": "direct_buyer", "label": PATHWAY_LABELS["direct_buyer"], "price_per_q": round(price, 1),
                         "days_to_cash": f["payment_days"], "risk": "medium", "counterparty": "Typical direct buyer",
                         "economics": d, "source": "assumption"})

    # 3. FPO aggregate
    fp = pd_["fpo"]
    fprice = modal * (1 + fp["price_premium"])
    f_ = compute_nrv(commodity=com, qty_q=qty, price_p50=fprice, price_p10=fprice * (1 - vol),
                     distance_km=mandi["distance_km"] + 40, channel="fpo", days=fp["wait_days"],
                     payment_days=fp["payment_days"], rejection_prob=fp["rejection_prob"],
                     transport_multiplier=tm, shared_transport=True, storage=True)
    pathways.append({"key": "fpo_aggregate", "label": PATHWAY_LABELS["fpo_aggregate"], "price_per_q": round(fprice, 1),
                     "days_to_cash": fp["wait_days"] + fp["payment_days"], "risk": "medium",
                     "counterparty": "Niphad Farmer Producer Co.", "economics": f_, "source": "simulated FPO"})

    # 4. Store N days
    max_days = min(cc["max_store_days"], 30)
    candidates = [w["wait_days"]] if w.get("wait_days") else list(range(1, min(max_days, 14) + 1))
    best = None
    for n in candidates:
        n = max(1, min(n, max_days))
        p10, p50, p90 = extend_band(fc, n, vol)
        p50s, p10s = _shock(p50, shock) * gm, _shock(p10, shock) * gm
        s = compute_nrv(commodity=com, qty_q=qty, price_p50=p50s, price_p10=p10s, distance_km=mandi["distance_km"],
                        channel="mandi", days=n, payment_days=1, rejection_prob=pd_["mandi"]["rejection_prob"],
                        transport_multiplier=tm, storage=True)
        if best is None or s["nrv"] > best["economics"]["nrv"]:
            best = {"key": "store", "label": f"Store {n} days, then mandi", "price_per_q": round(p50s, 1),
                    "band": {"p10": round(p10s, 1), "p50": round(p50s, 1), "p90": round(_shock(p90, shock) * gm, 1)},
                    "days_to_cash": n + 1, "risk": "high" if n > 7 else "medium", "wait_days": n,
                    "counterparty": mandi["name"], "economics": s, "source": f"forecast {fc['backtest']['champion']}"}
    pathways.append(best)

    # 5. Split lot: ratio sold now via best immediate channel, rest stored
    now_path = max(pathways[:2], key=lambda p: p["economics"]["nrv_per_q"])
    q_now, q_later = qty * split_ratio, qty * (1 - split_ratio)
    n1 = compute_nrv(commodity=com, qty_q=q_now, price_p50=now_path["price_per_q"],
                     price_p10=now_path["economics"]["inputs"]["price_p10"], distance_km=now_path["economics"]["inputs"]["distance_km"],
                     channel=now_path["economics"]["inputs"]["channel"], payment_days=now_path["economics"]["inputs"]["payment_days"],
                     rejection_prob=now_path["economics"]["inputs"]["rejection_prob"], transport_multiplier=tm)
    n2 = compute_nrv(commodity=com, qty_q=q_later, price_p50=best["band"]["p50"], price_p10=best["band"]["p10"],
                     distance_km=mandi["distance_km"], channel="mandi", days=best["wait_days"], payment_days=1,
                     rejection_prob=pd_["mandi"]["rejection_prob"], transport_multiplier=tm, storage=True)
    combined = {k: round(n1[k] + n2[k], 2) for k in ("gross", "transport", "handling", "commission", "storage", "spoilage", "risk_adjustment", "nrv")}
    combined["nrv_per_q"] = round(combined["nrv"] / qty, 2)
    combined["risk_breakdown"] = {k: round(n1["risk_breakdown"][k] + n2["risk_breakdown"][k], 2) for k in n1["risk_breakdown"]}
    combined["inputs"] = {"now": n1["inputs"], "later": n2["inputs"], "split_ratio": split_ratio}
    pathways.append({"key": "split", "label": f"Split {int(split_ratio*100)}% now / {int((1-split_ratio)*100)}% store {best['wait_days']}d",
                     "price_per_q": round(combined["gross"] / qty, 1), "days_to_cash": best["wait_days"] + 1,
                     "risk": "medium", "counterparty": f"{now_path['counterparty']} + storage", "economics": combined,
                     "source": "blend"})

    pathways.sort(key=lambda p: p["economics"]["nrv"], reverse=True)
    top, second = pathways[0], pathways[1]
    margin_pct = (top["economics"]["nrv"] - second["economics"]["nrv"]) / max(1.0, abs(second["economics"]["nrv"])) * 100

    # Confidence
    bt = fc["backtest"]
    mape = bt["mape"].get(bt["champion"], 15.0)
    factors = []
    conf = 85.0
    pen = min(30.0, mape * 2)
    conf -= pen
    factors.append({"factor": f"Forecast backtest MAPE {mape:.1f}% ({bt['champion']})", "delta": -round(pen)})
    if ctx.get("stale"):
        conf -= 15
        factors.append({"factor": f"Price data {ctx.get('freshness_days')} days old", "delta": -15})
    if margin_pct < 3:
        conf -= 10
        factors.append({"factor": f"Top two pathways within {margin_pct:.1f}%", "delta": -10})
    if ctx.get("fallback_level", "local") != "local":
        conf = min(conf, 40)
        factors.append({"factor": f"No local history; {ctx['fallback_level']} fallback (cap 40)", "delta": 0})
    conf = int(max(15, min(95, conf)))

    mandi_nrv = next(p for p in pathways if p["key"] == "mandi_now")["economics"]["nrv"]
    mav = ctx.get("min_acceptable_price") * qty if ctx.get("min_acceptable_price") else round(mandi_nrv, 2)
    now_cash = top["economics"]["nrv"] if top["days_to_cash"] <= 1 else (
        n1["nrv"] if top["key"] == "split" else 0.0)
    liquidity = {"cash_within_2_days": round(now_cash, 2), "cash_later": round(top["economics"]["nrv"] - now_cash, 2),
                 "days_to_full_cash": top["days_to_cash"], "pct_liquid_now": round(100 * now_cash / max(1, top["economics"]["nrv"]))}

    result = {
        "action": top["key"], "action_label": top["label"], "recommended": top, "pathways": pathways,
        "confidence": {"score": conf, "factors": factors},
        "alternatives": [{"key": p["key"], "label": p["label"], "nrv": p["economics"]["nrv"],
                          "delta_vs_best": round(p["economics"]["nrv"] - top["economics"]["nrv"], 2)} for p in pathways[1:]],
        "liquidity_impact": liquidity, "min_acceptable_value": round(mav, 2), "margin_pct": round(margin_pct, 2),
        "baseline_mandi_nrv": round(mandi_nrv, 2), "whatif": {"price_shock_pct": shock, "transport_multiplier": tm,
                                                              "split_ratio": split_ratio, "wait_days": w.get("wait_days")},
    }
    result["why"] = explain(ctx, result)
    return result
