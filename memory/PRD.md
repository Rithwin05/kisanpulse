# KisanPulse — SIH26132 PRD

## Original problem statement
Web app (React PWA, desktop-first demo). Decision-intelligence layer that turns market, buyer, logistics and storage data into one explainable, risk-adjusted selling decision for a farmer lot (Onion, Nashik; Tomato second; Soyabean third), then walks the lot to a closed transaction. Demo geography Maharashtra. Buyers never log in — seeded buyer-response simulator. Zero live external calls during demo. Trust Score demoted to rule-based "simulated history". No FPO/Buyer console; one read-only FPO card. One read-only Govt/MSAMB console.

## User choices (2026-09-07)
- Prices: fetch from data.gov.in with public sample key; **currently rate-limited → labelled `synthetic-seasonal` fallback in DB** (scheduler retries nightly 02:30; `POST /api/demo/refetch-agmarknet` triggers manually).
- LLM: skipped — template-only English explanations.
- Stack: React JS (CRA) + Tailwind + Recharts + MapLibre; FastAPI; MongoDB.
- No auth — single demo farmer (Ramesh Patil, Niphad, Nashik).
- Govt console: one read-only screen.

## Architecture
- `backend/engine/` pure-Python modules: `nrv.py` (deterministic NRV, `constants.yaml` with cited sources), `forecast.py` (seasonal-naive, ETS, LightGBM quantile P10/P50/P90, ensemble; rolling-origin backtest 4×7d, MAPE + band coverage), `match.py` (30/20/15/15/10/10 weighted buyer score, rule-based trust score), `decide.py` (5 pathways, confidence, liquidity, MAV), `explain.py` (template bullets). 20 pytest cases in `backend/tests/`.
- `backend/data/`: `ingest.py` (Agmarknet → normalise → anomaly flag >3σ → Mongo `prices`; synthetic fallback), `seed.py` (40 buyers w/ 2dsphere, 6 warehouses, transport rate table, arrivals, demand), `geo.py`.
- `server.py`: `/api/prices/*`, `/api/forecast`, `/api/decide` (what-if via `whatif` body), `/api/buyers/match` ($geoNear), `/api/lots`, `/api/offers/{id}/accept` (409 BELOW_MAV + override), `/api/transactions/{id}/advance`, `/api/lots/{id}/money-meter`, `/api/audit`, `/api/pulse`, `/api/console`, `/api/demo/*`. APScheduler: buyer simulator (3 offers at 10–20 s) + nightly ingest. Forecast cache in `forecast_cache` + memory.
- Frontend pages: Dashboard, Decide, Lots, LotPage, Pulse (MapLibre + OSM raster), Console.

## Implemented (2026-09-07)
- All 9 MUST features, edge-case policy (fallback cap 40, MAV warn+override+log, stale banner + penalty, anomaly flag/exclude, "logged for retraining").
- Full closed loop lot → offers → accept → logistics → payment (simulated) → outcome ledger → Money Meter computed from ledger.
- Testing agent iteration 1: backend 13/13, frontend e2e 100%.

## Known gaps / backlog
- P0: Real Agmarknet ingest once data.gov.in key not rate-limited (register own key → `DATA_GOV_API_KEY` in backend/.env). Currently synthetic-labelled.
- P1: Marathi/Hindi translation of explanation JSON via LLM (user deferred). Object Storage for lot photos (field exists, upload not wired). Offline tile cache. Demo restore script + headless smoke test.
- P2: Judge Q&A doc, PPT screenshots, Telangana seed on Pulse (present in DISTRICTS, no arrivals).
