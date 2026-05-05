# WorkforceGuard Dashboard

This is the current local implementation of the WorkforceGuard command-centre experience.

It includes:
- a FastAPI backend that serves curated overview, comparison, evidence-pack, ask, and governance endpoints
- a React + Vite frontend with benchmark-aware panels, evidence drawers, and analyst-console flows
- DuckDB-backed access to the modeled WorkforceGuard analytics data

## Prerequisites
- Python 3.12 recommended
- Node.js 18+ recommended

## Backend setup

The backend depends on:
- `fastapi`
- `uvicorn`
- `duckdb`
- `pandas`
- `pyarrow`

From the repo root:

```bash
cd dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Default backend URL:
- `http://127.0.0.1:8001`

Config overrides:
- `WORKFORCEGUARD_HOST`
- `WORKFORCEGUARD_PORT`

The backend reads from the local WorkforceGuard data assets under:
- `data/eu_raw`
- `data/workforceguard_analytics.duckdb`
- `analytics/seeds`

## Frontend setup

From the repo root:

```bash
cd dashboard/frontend
npm install
npm run dev
```

Default frontend URL:
- `http://localhost:5173`

The Vite dev server proxies `/api` and `/health` to:
- `http://127.0.0.1:8001`

You can override that target with:
- `VITE_API_PROXY_TARGET`

## Verification

Recommended checks:

```bash
./.venv-data/bin/python -m unittest dashboard/backend/tests/test_service.py
./.venv-data/bin/python -m unittest tests/test_prepare_reference_data.py
cd dashboard/frontend && npm run build
```

## Features
- **Comparative Intelligence**: EU, peer-country, direct market, sector, and prior-period benchmark flows.
- **Evidence And Provenance**: Evidence drawer, evidence-pack export, and named source metadata.
- **Governance Hooks**: Review actions are available in the UI and now persist to a local event log.
- **Real Data**: Connects to modeled WorkforceGuard data through DuckDB-backed backend logic.
