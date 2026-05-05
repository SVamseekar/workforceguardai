# WorkforceGuard Frontend

This app is the current React + Vite frontend for WorkforceGuard Phase 2.

## What it does

- renders the WorkforceGuard command-centre dashboard
- loads the curated `/api/overview` payload from the backend
- supports benchmark-aware comparison flows
- opens evidence drawers and exports evidence packs
- includes the analyst console for bounded comparison and action questions

## Local development

```bash
npm install
npm run dev
```

Default dev server:
- `http://localhost:5173`

## API proxy

The frontend proxies `/api` and `/health` to:
- `http://127.0.0.1:8001`

Override with:
- `VITE_API_PROXY_TARGET`

## Build

```bash
npm run build
```

## Notes

- The current Phase 2 implementation is country-level first.
- The UI explicitly communicates benchmark status, confidence, and partial coverage instead of overstating certainty.
- Internal employer-data flows are intentionally out of scope until Phase 3.
