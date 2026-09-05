# 02. Architecture Map: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

## 1. Repository Topology

```
WorkforceGuard-AI/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI: Gitleaks, Postgres 16 container, pytest, vitest, dbt compile
│       └── deploy.yml                # CD: SSH into GCP VM, rebuild container, restart systemd, deploy Vercel
├── analytics/                        # dbt project
│   ├── dbt_project.yml               # Config: vars, materializations, tags
│   ├── macros/                       # DuckDB path helpers, provenance, tenant_schema
│   │   ├── eu_paths.sql
│   │   ├── internal_paths.sql
│   │   ├── periods.sql
│   │   ├── provenance.sql
│   │   ├── public_company_paths.sql
│   │   ├── reference_paths.sql
│   │   └── tenant_schema.sql         # Dynamic per-tenant schema routing
│   ├── models/
│   │   ├── staging/                  # Views over raw Parquet
│   │   │   ├── eurostat/             # LFS, JVS, Slack, Flows, GPG
│   │   │   ├── internal/             # Payroll, HRIS, Job Architecture, Skills
│   │   │   └── public_company/       # Égapro, UK GPG
│   │   └── marts/
│   │       ├── core/                 # dim_geography, dim_sector, fct_labour_market, mart_semantic_metrics
│   │       ├── internal/             # fct_internal_pay_snapshot, mart_internal_market_pay_benchmark
│   │       ├── public_company/       # mart_egapro_sector_benchmark, mart_uk_gpg_sector_benchmark
│   │       └── reference/            # dim_metric_registry, dim_data_sources
│   └── seeds/                        # Static seed CSVs (metrics, sources, governance actions)
├── configs/
│   ├── eu_sources.yaml               # Eurostat API endpoints, filters, time spans
│   └── internal_sources.yaml         # Internal company file names and versions
├── dashboard/
│   ├── backend/                      # Python FastAPI service
│   │   ├── auth/                     # PostgreSQL auth, models, OAuth, sessions
│   │   │   ├── db.py                 # asyncpg connection pool & migration runner
│   │   │   ├── dependencies.py       # AuthContext, require_session, require_role
│   │   │   ├── models.py             # User, Tenant, Membership dataclasses
│   │   │   ├── oauth.py              # Authlib OAuth client setup & profile parsing
│   │   │   ├── redirects.py          # Frontend redirect URI builder
│   │   │   ├── repository.py         # PostgreSQL CRUD for users, tenants, memberships
│   │   │   ├── schema.sql            # DDL for tenants, users, oauth_identities, memberships, sessions
│   │   │   └── sessions.py           # itsdangerous HMAC signed session tokens
│   │   ├── Dockerfile                # Production container definition (python:3.12-slim)
│   │   ├── main.py                   # FastAPI app, route definitions, lifecycle guards
│   │   ├── migrate_to_tenant.py      # Migration CLI from single-tenant to multi-tenant
│   │   ├── service.py                # AnalyticsRepository & RepositoryRegistry (6,051 lines)
│   │   └── tests/                    # Pytest suite (route authorization, service, isolation)
│   └── frontend/                     # React 18 + Vite SPA
│       ├── api/
│       │   └── request-demo.js       # Vercel serverless function for marketing demo leads
│       ├── src/
│       │   ├── App.css               # Global dashboard styling & design tokens
│       │   ├── App.tsx               # Root component, router, React Query provider
│       │   ├── components/
│       │   │   ├── auth/             # LoginScreen
│       │   │   ├── landing/          # LandingPage, MissionPage, LegalPages, DemoRequestModal
│       │   │   ├── layout/           # TopBar, Sidebar, CopilotPanel
│       │   │   ├── primitives/       # MetricCard, ToneChip, FreshnessPill, StatusBadge
│       │   │   ├── research/         # ResearchHeatmap, ResearchScatterChart, TrajectoryChart
│       │   │   ├── sections/         # HomeSection, MarketSection, CompareSection, PayAnalysisSection, GovernSection
│       │   │   └── shared/           # FilterBar, EvidenceDrawer, ChartPanel, DataState
│       │   ├── contexts/             # AuthContext
│       │   ├── hooks/                # useOverviewData, useAuth, useResearchPanel
│       │   └── lib/                  # api.ts (Axios), normalizeOverview.ts, auth-errors.ts
│       ├── package.json              # React 18, Vite 5, TanStack Query 5, Recharts 2, Tailwind 3
│       └── vercel.json               # Vercel deployment rewrites and API proxies
├── data/                             # Data root (DuckDB, Parquet, SQLite)
│   ├── eu_raw/                       # Raw Eurostat snappy Parquet files
│   ├── eu_meta/                      # Eurostat JSON metadata & manifest.json
│   ├── reference/                    # ESCO reference Parquet assets
│   ├── public_company/               # Égapro & UK GPG Parquet assets
│   ├── tenants/                      # Per-tenant data storage
│   │   ├── _public/                  # Public repo fallback storage
│   │   └── {tenant_id}/              # Tenant directory: internal/, sqlite, json
│   └── workforceguard_analytics.duckdb # Shared analytical DuckDB database
├── deploy/                           # Deployment & Operations
│   ├── configure-api-nginx.sh        # Nginx reverse proxy setup on GCP VM
│   ├── domains.env                   # Domain configuration (API_HOST, FRONTEND_URL)
│   ├── ensure-postgres.sh            # Local PostgreSQL 16 docker startup script
│   ├── gcp-service.sh                # Start/stop/status controller for GCP VM
│   ├── install-service.sh            # Systemd service installer
│   ├── setup-vm.sh                   # Initial VM package provisioning
│   ├── sync-production-env.sh        # Environment synchronization
│   ├── verify-production.sh          # Smoke tests against production endpoints
│   └── workforceguard-api.service    # Systemd unit file running dockerized API
├── docker-compose.yml                # Local developer backend (PostgreSQL 16 + FastAPI)
└── scripts/                          # Ingestion, seeding, and demo synthesis scripts
```

---

## 2. Runtime Architecture & Process Model

```
                                [Client Browser]
                                        │
                    ┌───────────────────┴───────────────────┐
                    │ HTTPS                                 │ HTTPS
                    ▼                                       ▼
           [Vercel Edge Network]                   [Google Cloud Platform]
         workforceguardai.souravamseekar.com      api.souravamseekar.com
                    │                                       │
                    ▼                                       ▼
           React 18 SPA (Static)                 GCP VM (us-central1-f)
                                                    └─► Nginx (:443)
                                                          │ Reverse Proxy
                                                          ▼
                                                    Docker Container (:8080)
                                                    uvicorn main:app (Python 3.12)
                                                          │
                                     ┌────────────────────┴────────────────────┐
                                     ▼                                         ▼
                            [PostgreSQL 16 Engine]                   [Local Embedded Storage]
                            (:5432)                                  ├── workforceguard_analytics.duckdb
                            - Users & Memberships                    ├── data/tenants/{id}/governance_events.sqlite
                            - Sessions (expires_at)                  ├── data/tenants/{id}/automation_schedules.json
                            - OAuth Identities                       └── data/eu_raw/*.parquet
```

### Components and Process Boundaries
1. **Frontend Process**:
   - Client-side React 18 Single Page Application served via Vercel CDN.
   - All client queries use Axios against the backend API via HTTPS.
2. **API Process**:
   - Managed by systemd ([`deploy/workforceguard-api.service`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/deploy/workforceguard-api.service)) executing a Docker container:
     ```bash
     uvicorn main:app --host 0.0.0.0 --port 8080
     ```
   - Python 3.12-slim base with non-root user `appuser`.
3. **Relational Database (PostgreSQL)**:
   - Dedicated PostgreSQL 16 instance. In production, runs locally on the GCP host or Cloud SQL, bound to port 5432.
   - Used solely for identity, authorization, session expiry, and tenant linkage.
4. **Analytical Database (DuckDB)**:
   - In-process analytical database engine embedded within the FastAPI worker processes.
   - Read-heavy queries connect using `read_only=True`.
5. **Audit Database (SQLite)**:
   - Standalone SQLite databases (`governance_events.sqlite`) isolated on disk per tenant.

---

## 3. Frontend Architecture

### Technology Stack
- **Framework**: React 18 + TypeScript + Vite 5 ([`dashboard/frontend/package.json`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/package.json)).
- **State Management & Fetching**: TanStack React Query v5 (`QueryClient` configured with `staleTime: 60_000` and `retry: 2`).
- **Routing**: `react-router-dom` v6 with HTML5 history pushState.
- **Visualizations**: `recharts` v2 (ResponsiveContainer, LineChart, BarChart, ScatterChart).
- **Styling**: Vanilla CSS design tokens with Tailwind CSS utility classes.

### Routing Layout
[`dashboard/frontend/src/App.tsx:L115-L133`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/App.tsx#L115-L133):
- Public Routes:
  - `/` -> [`LandingPage.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/landing/LandingPage.tsx)
  - `/mission` -> [`MissionPage.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/landing/MissionPage.tsx)
  - `/privacy`, `/terms`, `/disclaimer`, `/refunds` -> Static legal and compliance disclosures
- Authenticated Application Routes (`/app/*` wrapped by `AuthGate` and `AuthProvider`):
  - `/app` -> [`HomeSection.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/HomeSection.tsx) (Executive Command Centre)
  - `/app/market` -> [`MarketSection.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/MarketSection.tsx) (Macro Market Signals)
  - `/app/compare` -> [`CompareSection.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/CompareSection.tsx) (Country & Sector Benchmark Comparators)
  - `/app/research` -> [`ResearchSection.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/ResearchSection.tsx) (Academic Paper Empirical Trajectories & Heatmaps)
  - `/app/pay-analysis` -> [`PayAnalysisSection.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/PayAnalysisSection.tsx) (Internal vs. Market Pay Gap Simulation)
  - `/app/govern` -> [`GovernSection.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/GovernSection.tsx) (Hash-Chain Audit Log, Schedules & Evidence Pack)

### Data Fetching Hook: `useOverviewData`
Defined in [`dashboard/frontend/src/hooks/useOverviewData.ts`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/hooks/useOverviewData.ts):
- Synchronizes search parameters with URL query string (`country`, `geography`, `sector`, `period`, `benchmark_geography`, `benchmark_sector`).
- Queries `/api/overview` via `useQuery({ queryKey: ['overview', filters] })`.
- Exposes mutations:
  - `exportMutation`: Calls `GET /api/evidence-pack`, streams JSON to client download, and triggers an `exported` governance event if admin.
  - `governanceMutation`: Calls `POST /api/governance-events`, invalidates query key `['overview']`.
  - `uploadPayrollMutation`: Sends multipart CSV to `POST /api/upload/payroll`.
  - `scheduleMutation`: Posts recurring automation schedules to `POST /api/automation/schedules`.

---

## 4. Backend Architecture

### Application & Routing Layer
- **Framework**: FastAPI ([`dashboard/backend/main.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py)).
- **Lifespan Context**: Runs PostgreSQL schema migrations on boot if `DATABASE_URL` is set ([`main.py:L111-L122`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L111-L122)).
- **Security Middleware**:
  - `SessionMiddleware` with `SESSION_SECRET` ([`main.py:L127`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L127)).
  - `CORSMiddleware` with strict regex-validated origins ([`main.py:L137-L157`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L137-L157)).
- **Guarded Invocation Pattern**: All service calls wrapped in `guarded()`:
  ```python
  def guarded(callable_fn, *args, **kwargs):
      try:
          return callable_fn(*args, **kwargs)
      except FileNotFoundError as error:
          raise HTTPException(status_code=404, detail=str(error))
      except ValueError as error:
          raise HTTPException(status_code=400, detail=str(error))
      except Exception as error:
          raise HTTPException(status_code=500, detail=str(error))
  ```

### Service & Repository Registry Pattern
Defined in [`dashboard/backend/service.py:L6016-L6051`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L6016-L6051):
- **`RepositoryRegistry`**:
  - Maintains a dictionary of active [`AnalyticsRepository`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L196) instances keyed by `tenant_id`.
  - Manages isolated tenant storage paths:
    ```python
    tenant_dir = self.root_dir / "data" / "tenants" / tenant_id
    self._repositories[tenant_id] = AnalyticsRepository(
        root_dir=self.root_dir,
        governance_events_path=tenant_dir / "governance_events.sqlite",
        automation_schedules_path=tenant_dir / "automation_schedules.json",
        internal_data_dir=tenant_dir / "internal",
        tenant_id=tenant_id,
    )
    ```
  - Provides a fallback `public_repository` pointing to `data/tenants/_public/` for non-authenticated global metadata (e.g. governance actions catalog).
- **Dependency Injection**:
  FastAPI endpoint routes use `get_repository`:
  ```python
  def get_repository(ctx: AuthContext = Depends(require_session)) -> AnalyticsRepository:
      return repository_registry.get_for_tenant(ctx.tenant_id)
  ```

---

## 5. Authentication & Session Architecture

### Relational Auth Schema
Defined in [`dashboard/backend/auth/schema.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/schema.sql):
- `tenants` (`id UUID PRIMARY KEY`, `name TEXT`, `slug TEXT UNIQUE`, `created_at TIMESTAMPTZ`).
- `users` (`id UUID PRIMARY KEY`, `email TEXT UNIQUE`, `display_name TEXT`, `created_at TIMESTAMPTZ`).
- `oauth_identities` (`id UUID PRIMARY KEY`, `user_id UUID REFERENCES users`, `provider TEXT CHECK ('google', 'microsoft')`, `provider_subject TEXT`, `UNIQUE(provider, provider_subject)`).
- `memberships` (`id UUID PRIMARY KEY`, `user_id UUID REFERENCES users`, `tenant_id UUID REFERENCES tenants`, `role TEXT CHECK ('admin', 'member')`, `UNIQUE(user_id, tenant_id)`).
- `sessions` (`id UUID PRIMARY KEY`, `user_id UUID REFERENCES users`, `tenant_id UUID REFERENCES tenants`, `created_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `auth_provider TEXT`).

### Session Lifecycle
1. **OAuth Sign-in** ([`dashboard/backend/main.py:L171-L254`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L171-L254)):
   - Initiates redirect to Google or Microsoft via Authlib.
   - Callback validates ID token, matches or creates the user in PostgreSQL, and verifies tenant membership.
   - If auto-provisioning is active and user is new, auto-creates a tenant based on the email domain and assigns `role = 'admin'`.
   - Generates a UUID `session_id` in PostgreSQL expiring in 7 days.
2. **Session Cookie**:
   - Generates an HMAC-signed token using `itsdangerous.URLSafeTimedSerializer(secret, salt="wfg-session")` containing `{"session_id": ..., "max_age": ...}`.
   - Emits an HTTP-only, SameSite=Lax cookie named `wfg_session`.
3. **Session Verification** ([`dashboard/backend/auth/dependencies.py:L21-L55`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py#L21-L55)):
   - Unpacks cookie, verifies HMAC signature and timestamp.
   - Queries PostgreSQL joining `sessions`, `memberships`, and `users` to construct `AuthContext`.
4. **Role Authorization** ([`dashboard/backend/auth/dependencies.py:L57-L63`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py#L57-L63)):
   - `_ROLE_RANK = {"member": 0, "admin": 1}`.
   - Endpoints tagged `require_role("admin")` block non-admin users with HTTP 403 Forbidden.

---

## 6. Tenant Isolation Architecture

Tenant isolation operates across three independent tiers:

| Tier                     | Storage Mechanism | Isolation Boundary                                   | Enforcement Point                                      |
| ------------------------ | ----------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| **Identity & Sessions**  | PostgreSQL        | `tenant_id` Foreign Keys                             | `AuthContext` + `memberships` table queries            |
| **Audit Logs**           | SQLite            | `data/tenants/{tenant_id}/governance_events.sqlite`  | File system path separation via `RepositoryRegistry`   |
| **Automation Schedules** | JSON              | `data/tenants/{tenant_id}/automation_schedules.json` | File system path separation via `RepositoryRegistry`   |
| **Raw Payroll Files**    | Snappy Parquet    | `data/tenants/{tenant_id}/internal/`                 | File system path separation via `RepositoryRegistry`   |
| **Analytical Marts**     | DuckDB            | Schema namespace: `tenant_<sanitized_uuid>`          | `SET search_path = 'tenant_<id>,main'` in `_connect()` |

### DuckDB Schema Isolation Logic
1. **Schema Name Sanitization** ([`service.py:L159-L164`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L159-L164)):
   UUIDs with hyphens are transformed to valid SQL identifiers:
   ```python
   def tenant_schema_name(tenant_id: str) -> str:
       safe = re.sub(r"[^a-zA-Z0-9_]", "_", tenant_id).lower()
       return f"tenant_{safe}"
   ```
2. **Search Path Resolution** ([`service.py:L495-L518`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L495-L518)):
   DuckDB resolves unqualified table names by walking schemas in order. Setting `'tenant_<id>,main'` guarantees that queries for `fct_internal_pay_snapshot` hit the tenant's schema, while queries for macro tables like `fct_labour_market_region_sector` fall through to `main`.
3. **Fail-Closed Contamination Guard** ([`service.py:L538-L552`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L538-L552)):
   If a table present in `INTERNAL_TAGGED_TABLES` ever appears in the `main` schema, `AnalyticsRepository._connect()` immediately halts execution:
   ```python
   def _assert_main_has_no_internal_tables(self, connection: duckdb.DuckDBPyConnection) -> None:
       rows = connection.execute(
           "select table_name from information_schema.tables where table_schema = 'main'"
       ).fetchall()
       contaminated = INTERNAL_TAGGED_TABLES.intersection({row[0] for row in rows})
       if contaminated:
           raise RuntimeError(
               "Internal-tagged table(s) found in the shared 'main' schema: "
               + ", ".join(sorted(contaminated))
               + ". Drop them from 'main' and re-run dbt with --vars '{\"tenant_schema\": \"...\"}'."
           )
   ```

---

## 7. Deployment & Infrastructure Topology

### Cloud Infrastructure
- **Cloud Provider**: Google Cloud Platform (GCP).
- **Virtual Machine**: `workforceguard-vm` running in zone `us-central1-f`, project `workforceguard-prod`.
- **Operating System**: Debian/Ubuntu with Docker and systemd.
- **On-Demand Control**: [`deploy/gcp-service.sh`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/deploy/gcp-service.sh) manages `start`, `stop`, and `status` of the VM via `gcloud compute instances` to minimize idle computing costs.

### In-VM Process Topology
- **Systemd Unit** ([`deploy/workforceguard-api.service`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/deploy/workforceguard-api.service)):
  ```ini
  [Unit]
  Description=WorkforceGuard Analytics API
  After=docker.service network-online.target
  Requires=docker.service

  [Service]
  Type=simple
  Restart=always
  RestartSec=5
  ExecStart=/usr/bin/docker run --rm --name workforceguard-api \
    --network host \
    --env-file /home/souravamseekarmarti/WorkforceGuard-AI/.env.production \
    -v /home/souravamseekarmarti/WorkforceGuard-AI/data:/data \
    -p 8080:8080 \
    workforceguard-api:latest
  ExecStop=/usr/bin/docker stop -t 10 workforceguard-api
  ```
- **Nginx Ingress** ([`deploy/configure-api-nginx.sh`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/deploy/configure-api-nginx.sh)):
  Terminates SSL via Let's Encrypt / Certbot on port 443 and reverse proxies to `http://127.0.0.1:8080`.

### Frontend Ingress
- **Host**: Vercel Serverless Edge Platform.
- **Domains**: `workforceguard-ai.vercel.app` aliased to production custom domain `workforceguardai.souravamseekar.com`.
- **Rewrites** ([`dashboard/frontend/vercel.json`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/vercel.json)):
  Proxies all `/api/*` calls from the frontend to `https://api.souravamseekar.com/api/*` while preserving single-page routing for SPA paths.

---

## 8. Continuous Integration & Continuous Deployment (CI/CD)

### Pull Request CI Workflow ([`.github/workflows/ci.yml`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/.github/workflows/ci.yml))
1. **Path Filtering**: `dorny/paths-filter` runs only relevant jobs based on changed paths (`python`, `frontend`, `analytics`).
2. **Secret Scan**: `gitleaks/gitleaks-action` checks git history for committed tokens.
3. **Database Spin-up**: Launches a Docker service container running `postgres:16` with healthcheck.
4. **dbt Database Compilation**:
   ```bash
   dbt seed --profiles-dir .
   dbt run --profiles-dir . --exclude tag:internal
   ```
5. **Python Backend Tests**:
   ```bash
   python -m pytest dashboard/backend/tests/ -q --tb=short
   python -m pytest tests/ -q --tb=short
   ```
6. **Frontend Checks**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

### Production Deployment Workflow ([`.github/workflows/deploy.yml`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/.github/workflows/deploy.yml))
1. Triggers on workflow completion of `CI` on branch `main`.
2. Starts the GCP VM if stopped.
3. Establishes SSH connection to VM via `webfactory/ssh-agent`.
4. Fetches latest `main`, updates environment, runs migrations, rebuilds Docker container, restarts systemd service, and verifies `/health`.
5. Deploys frontend SPA to Vercel and aliases to `workforceguardai.souravamseekar.com`.
6. Executes post-deployment smoke verification script ([`deploy/verify-production.sh`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/deploy/verify-production.sh)).
