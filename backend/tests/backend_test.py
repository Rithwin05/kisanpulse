"""
KisanPulse comprehensive backend test suite.
Covers: demo state, prices, forecast, decide, buyers/match, pulse, console, audit,
and the full lot→offers→accept→advance transaction lifecycle.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to reading frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Meta / Dashboard endpoints ----------------

class TestMeta:
    def test_demo_state(self, client):
        r = client.get(f"{API}/demo/state", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "demo_today" in data or "today" in data

    def test_prices_meta(self, client):
        r = client.get(f"{API}/prices/meta", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), (dict, list))

    def test_prices_latest_onion(self, client):
        r = client.get(f"{API}/prices/latest", params={"commodity": "Onion"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data is not None

    def test_prices_series(self, client):
        r = client.get(
            f"{API}/prices/series",
            params={"commodity": "Onion", "market": "Lasalgaon", "days": 90},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        # series expected to be a list or dict containing series
        assert data is not None

    def test_forecast_shape(self, client):
        r = client.get(
            f"{API}/forecast",
            params={"commodity": "Onion", "market": "Lasalgaon"},
            timeout=90,  # first call may train ~20s
        )
        assert r.status_code == 200
        data = r.json()
        p10 = data.get("p10", [])
        p50 = data.get("p50", [])
        p90 = data.get("p90", [])
        assert len(p10) == len(p50) == len(p90) > 0, f"bad forecast shape: {len(p10)},{len(p50)},{len(p90)}"
        for a, b, c in zip(p10, p50, p90):
            assert a <= b <= c, f"p10<=p50<=p90 violated: {a},{b},{c}"
        # backtest.mape
        bt = data.get("backtest", {})
        mape = bt.get("mape", {}) if isinstance(bt, dict) else {}
        for k in ["lgbm", "ets", "snaive", "ensemble"]:
            assert k in mape, f"backtest.mape missing {k}: {mape}"

    def test_buyers_match(self, client):
        r = client.get(f"{API}/buyers/match", timeout=30)
        assert r.status_code == 200

    def test_pulse(self, client):
        r = client.get(f"{API}/pulse", params={"commodity": "Onion"}, timeout=30)
        assert r.status_code == 200

    def test_console(self, client):
        r = client.get(f"{API}/console", timeout=60)
        assert r.status_code == 200

    def test_audit(self, client):
        r = client.get(f"{API}/audit", timeout=30)
        assert r.status_code == 200


# ---------------- Decide endpoint ----------------

class TestDecide:
    def test_decide_default(self, client):
        t0 = time.time()
        r = client.post(f"{API}/decide", json={}, timeout=60)
        latency = (time.time() - t0) * 1000
        assert r.status_code == 200
        data = r.json()
        pathways = data.get("pathways", [])
        assert len(pathways) == 5, f"expected 5 pathways, got {len(pathways)}"
        nrvs = [p["economics"]["nrv"] for p in pathways]
        assert nrvs == sorted(nrvs, reverse=True), "pathways not sorted by nrv desc"
        assert data.get("action") == pathways[0]["key"]
        assert "confidence" in data and "score" in data["confidence"]
        assert data.get("why") and len(data["why"]) > 0
        assert "alternatives" in data
        assert "liquidity_impact" in data
        assert "min_acceptable_value" in data
        reported_latency = data.get("latency_ms")
        if reported_latency is not None:
            assert reported_latency < 300, f"latency_ms {reported_latency} >= 300"
        print(f"decide latency wall={latency:.0f}ms reported={reported_latency}")

    def test_decide_price_shock(self, client):
        base = client.post(f"{API}/decide", json={}, timeout=60).json()
        shocked = client.post(
            f"{API}/decide", json={"whatif": {"price_shock_pct": -10}}, timeout=60
        ).json()
        base_nrvs = [p["economics"]["nrv"] for p in base["pathways"]]
        shk_nrvs = [p["economics"]["nrv"] for p in shocked["pathways"]]
        # Most pathways should decrease
        decreased = sum(1 for a, b in zip(sorted(base_nrvs), sorted(shk_nrvs)) if b < a)
        assert decreased >= 3, f"price shock did not lower NRVs enough: base={base_nrvs} shk={shk_nrvs}"

    def test_decide_wait_days(self, client):
        r = client.post(f"{API}/decide", json={"whatif": {"wait_days": 3}}, timeout=60)
        assert r.status_code == 200
        pathways = r.json()["pathways"]
        wait_p = next((p for p in pathways if "wait" in p["key"].lower() or p.get("wait_days") is not None), None)
        assert wait_p is not None, f"no wait pathway found: {[p['key'] for p in pathways]}"
        assert wait_p.get("wait_days") == 3, f"wait_days not stored: {wait_p}"


# ---------------- Full lot lifecycle ----------------

class TestLotLifecycle:
    def test_full_flow(self, client):
        # Create lot
        r = client.post(f"{API}/lots", json={}, timeout=30)
        assert r.status_code in (200, 201), r.text
        lot = r.json()
        lot_id = lot.get("id") or lot.get("lot_id") or lot.get("_id")
        assert lot_id, f"no lot id: {lot}"
        assert lot.get("status") == "open"

        # Poll for 3 offers up to ~35s
        offers = []
        deadline = time.time() + 35
        while time.time() < deadline:
            gr = client.get(f"{API}/lots/{lot_id}", timeout=15)
            assert gr.status_code == 200
            offers = gr.json().get("offers", [])
            if len(offers) >= 3:
                break
            time.sleep(2)
        assert len(offers) >= 3, f"expected 3 offers, got {len(offers)}"

        # Sort offers by price desc to find best & below-MAV (3rd/lowest)
        offers_sorted = sorted(offers, key=lambda o: o.get("price") or o.get("offer_price") or 0, reverse=True)
        below_mav = [o for o in offers if o.get("below_mav")]
        assert len(below_mav) >= 1, f"no below_mav offer: {offers}"
        below = below_mav[0]
        below_id = below.get("id") or below.get("offer_id")

        # Try to accept below-MAV without override → 409
        ar = client.post(f"{API}/offers/{below_id}/accept", json={"override": False}, timeout=15)
        assert ar.status_code == 409, f"expected 409, got {ar.status_code}: {ar.text}"
        detail = ar.json().get("detail", {})
        code = detail.get("code") if isinstance(detail, dict) else None
        assert code == "BELOW_MAV", f"expected code BELOW_MAV, got {detail}"

        # Accept best offer (highest price that isn't below_mav and is open)
        best = next(
            (o for o in offers_sorted if not o.get("below_mav") and o.get("status", "open") == "open"),
            offers_sorted[0],
        )
        best_id = best.get("id") or best.get("offer_id")
        ar2 = client.post(f"{API}/offers/{best_id}/accept", json={"override": False}, timeout=15)
        assert ar2.status_code == 200, f"accept best failed: {ar2.status_code} {ar2.text}"
        tx = ar2.json()
        tx_id = tx.get("id") or tx.get("transaction_id") or tx.get("tx_id")
        # tx may be nested
        if not tx_id and "transaction" in tx:
            tx_id = tx["transaction"].get("id")
            tx = tx["transaction"]
        assert tx_id, f"no tx id: {tx}"
        assert tx.get("stage") == "accepted", f"stage != accepted: {tx.get('stage')}"

        # Advance 5 times
        expected_stages = [
            "logistics_booked",
            "in_transit",
            "delivered",
            "payment_released",
            "closed",
        ]
        for exp in expected_stages:
            ar3 = client.post(f"{API}/transactions/{tx_id}/advance", json={}, timeout=15)
            assert ar3.status_code == 200, f"advance to {exp} failed: {ar3.text}"
            body = ar3.json()
            stage = body.get("stage") or body.get("transaction", {}).get("stage")
            assert stage == exp, f"expected {exp}, got {stage}"

        # Money meter
        mm = client.get(f"{API}/lots/{lot_id}/money-meter", timeout=15)
        assert mm.status_code == 200
        mm_data = mm.json()
        assert mm_data.get("complete") is True, f"money meter not complete: {mm_data}"
        realised = mm_data.get("realised", {})
        assert isinstance(realised.get("nrv"), (int, float))
        assert "delta" in mm_data

        # Audit
        aud = client.get(f"{API}/audit", params={"lot_id": lot_id}, timeout=15)
        assert aud.status_code == 200
        events = aud.json()
        if isinstance(events, dict):
            events = events.get("events", events.get("audit", []))
        event_types = [e.get("type") or e.get("event") for e in events]
        for expected in ["lot_created", "offer_accepted", "tx_closed"]:
            assert expected in event_types, f"missing audit {expected}: {event_types}"
        offer_received_count = sum(1 for t in event_types if t == "offer_received")
        assert offer_received_count >= 3, f"expected 3 offer_received, got {offer_received_count}"
