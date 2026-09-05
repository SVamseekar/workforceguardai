# Design Decisions

ADR-style records of decisions that are actually visible in the repository — code, commit messages, or explicit project documents (`docs/SECURITY_AUDIT.md`, `docs/METRICS_CANONICAL.md`, `paper/novelty_implementation_spec.md`). Where a decision is inferred rather than stated outright, that's flagged.

---

## ADR-1: DuckDB single-file warehouse instead of a managed database server

**Context:** The system needs to serve pre-computed compliance-grade metrics to a dashboard, with per-tenant data isolation, at a scale of a small number of B2B customers rather than a high-traffic consumer product.

**Decision:** Use DuckDB as the query engine, materialized by dbt from Parquet, as a single file with no separate database server process. Auth/session state is kept in a *separate* Postgres instance rather than folded into the same store.

**Consequences:**
- Simple to run locally (no infra dependency) and simple to back up (copy a file) — but "no backup strategy" and "no scheduled DuckDB snapshots" were explicitly flagged as gaps in the (now superseded) technical assessment.
- DuckDB has no native multi-tenant access-control primitive, which forced a bespoke tenant-isolation scheme (see ADR-2) rather than relying on database-level grants.
- Splitting auth (Postgres, transactional) from analytics (DuckDB, file-based, mostly read-only) keeps the compliance-metric storage decoupled from session/OAuth lifecycle, at the cost of two storage systems to operate.

---

## ADR-2: Per-tenant DuckDB schema isolation, discovered incomplete on first attempt

**Context:** Once the product became multi-tenant, internal company payroll data for different customers had to be strictly isolated inside the shared DuckDB warehouse — a compliance product leaking one customer's pay data into another's dashboard would be a severe incident, not a cosmetic bug.

**Decision:** Give each tenant its own DuckDB schema (`tenant_<sanitized-tenant-id>`), with DuckDB's `search_path` resolving unqualified table names against the tenant's schema first. A `RepositoryRegistry` caches one `AnalyticsRepository` per tenant, each configured with `tenant_id`/`tenant_schema`.

**Consequences:**
- This is materially cheaper than a database-per-tenant model while still giving hard schema boundaries.
- The first isolation fix (commit `b7a8fb2`, "isolate internal payroll data per tenant") was **incomplete**: a follow-up adversarial review (commit `949ae89`) found that DuckDB's `search_path` fallback to the shared `"main"` schema could still leak a table that existed in `main` but not in a given tenant's schema, if that tenant's schema hadn't been populated by a given dbt run. The fix added an explicit `_assert_main_has_no_internal_tables`-style guard and a retry for schema-creation lock conflicts.
- The practical lesson embedded in the commit history: a first isolation implementation that "looks correct" (each tenant reads its own schema) can still leak via the database's own name-resolution fallback behavior — this class of bug is specifically why the project has a dedicated `test_tenant_schema_isolation.py` suite rather than relying on manual review alone.

---

## ADR-3: SHA-256 hash-chained governance log

**Context:** The product's core compliance promise is that every human decision affecting a compliance record (approve, override, reverse, export) is auditable and, specifically, that the audit trail itself cannot be silently edited after the fact — this is a claim the Directive's "evidence pack" use case depends on.

**Decision:** Each governance event stores `event_hash` and `previous_hash`, chained back to a `GENESIS` anchor. `_governance_event_hash()` computes a SHA-256 digest over the event payload (excluding the hash field itself, JSON-serialized with sorted keys for determinism); integrity is checked on read by walking the chain and comparing expected vs. stored hashes for every event.

**Consequences:**
- Any modification to a past event's payload after the fact breaks the chain from that point forward and is detectable (`verified: false`).
- This does *not* protect against an attacker who can rewrite the entire chain from `GENESIS` (there's no external anchor, no separate signing key, no append-only storage guarantee at the OS/DB level) — it detects accidental or naive tampering, not a fully compromised host. The security audit's Finding 1/2 (no auth on any endpoint, including the governance-write endpoint) meant, at the time of that audit, an anonymous caller could forge new chain-consistent events with an arbitrary actor field — the hash chain guarantees internal consistency of the log, not the truthfulness of who wrote to it, unless writes are themselves authenticated.
- The `event_id` scheme (`evt_{n:04d}`, sequential based on in-memory list length) is **not** globally unique across process restarts per the (now partially outdated, but still architecturally accurate on this point) reference doc — a real audit-grade identifier scheme would need process-independent uniqueness (e.g., UUIDs).

---

## ADR-4: Metrics computed in SQL/dbt; LLM layer, where present, is templated over pre-computed numbers, not generative

**Context:** The product answers natural-language questions and generates narrative summaries in a domain (pay-transparency compliance) where a hallucinated or drifting number could have legal consequences for a customer relying on it.

**Decision:** All four composite indices (Hiring Pressure Index, Labour Resilience, Equity Risk Score, Transition Readiness) and all pay-transparency review classifications are computed entirely in dbt SQL models, driven by a versioned metric registry (`ref_metric_registry.csv`) and stored thresholds in mart SQL (not application-code constants). The analyst/copilot response layer selects from templated response categories (comparison, trend, vacancy, equity, internal/company, pay-transparency) via keyword routing over the question text, then composes a response from the already-computed SQL outputs.

**Consequences:**
- Every number a user sees is reproducible byte-for-byte from the same warehouse vintage — a real advantage for a compliance evidence pack, and explicitly framed this way in the README ("Metrics before LLMs — Business logic lives in SQL models, not prompts").
- The "AI copilot" label is honest but potentially misleading without this context: at the level documented (as of the last full internal review), there is no generative-model call in the loop; it is keyword-routed template composition. Product/marketing copy should be checked against current code before claiming LLM-backed reasoning, since this is exactly the kind of claim that can silently become true (or stay false) as the codebase evolves without doc updates.
- Governance thresholds (5% / 10% / 2% market-delta) living in mart SQL rather than in `service.py` is a deliberate rule documented in the (stale but architecturally-still-relevant) reference doc: "the mart output is the evidence record" — i.e., the audit trail should show the same thresholds that produced the classification, not a separate application constant that could drift from what's actually in the data.

---

## ADR-5: Trust-gated internal data ("company-aware" claims are opt-in, not automatic)

**Context:** Internal payroll/HRIS data can be partially uploaded, malformed, or unvalidated. Surfacing a "company pay gap" number derived from incomplete data as if it were a trustworthy compliance figure would be worse than showing nothing.

**Decision:** Company-specific claims (internal pay-gap figures, benchmark comparisons, pay-transparency review items) are gated behind an internal-data manifest flag, `trusted_for_company_claims: true`, checked per required source (payroll snapshot, job architecture) before those sections of the API response report `available: true`.

**Consequences:**
- Protects against silently promoting untrusted data to "ground truth" status in a legally-relevant output.
- The security audit (Finding 2) notes this gate is currently enforceable only at the *manifest* level, not at the *authorization* level: an unauthenticated upload endpoint could flip a tenant from "no trusted data" to "trusted" without any human approval step, which defeats the intent of the gate if the upload endpoint itself isn't also access-controlled. The documented fix direction is an explicit governance-approved promotion step, separate from upload.

---

## ADR-6: Worker-category as the canonical comparison unit (domain-driven modeling choice)

**Context:** The Directive requires pay-gap reporting and justification "by worker category" (workers performing the same work or work of equal value) — not a single company-wide gap number.

**Decision:** Model `dim_worker_category` explicitly, derived from the internal job architecture (job family, job level, representative NACE code, ESCO URI), and compute internal pay-gap and pay-transparency review state *per worker category*, not just at company grain.

**Consequences:**
- This aligns the data model directly with what a regulator will actually ask an employer to produce, rather than a generic HR "band" or "level" abstraction that might not map to the legal unit of comparison.
- It does add real ingestion complexity: a customer has to supply a job architecture that can plausibly represent "equal value" groupings, which is a harder data problem than uploading flat payroll rows. The shipped repo's internal data is explicitly sample/synthetic (a handful of rows) — this is a genuine current limitation, not a hidden one (documented in the "known gaps" material and `docs/METRICS_CANONICAL.md`'s "do not claim" list).

---

## ADR-7: Research paper and product share the same metric definitions

**Context:** The author is simultaneously building a compliance product and an empirical research paper (`paper/main.tex`, MPRA working paper) analyzing whether labour-market tightness closes gender pay gaps across the EU.

**Decision:** The paper's panel-export scripts, sector-heterogeneity tests, and PCA validation of the HPI weighting scheme (per commit history: `feat(paper): add PCA validation of HPI weighting scheme`, `feat(paper): add panel fixed-effects regression`) reuse the *same* composite-index definitions (HPI, ERS, etc.) that the live product computes, rather than maintaining a separate research-only formula set. A public `/app/research` route in the product surfaces the paper's own findings (Combined Risk Quadrant, sector heterogeneity) inside the dashboard.

**Consequences:**
- Keeps the empirical claims in the paper directly falsifiable against the same code a user of the product is looking at — a stronger reproducibility posture than a paper with a separate, undisclosed analysis codebase.
- It also means a change to the HPI formula (to improve the product) is simultaneously a change to the paper's methodology, and the commit history shows multiple "re-run X with corrected N-country panel" commits — evidence that at least one methodology correction (moving from an earlier country count to the current 27-country panel) propagated through both paper and dashboard. This coupling is a deliberate trade-off: correctness discipline is shared, but so is correction *cost* — a data bug found late affects both artifacts at once, which is presumably why the commit history shows a cascade of "re-run figures/tables/robustness checks" commits after the panel correction.

---

## ADR-8: CORS and transport security hardened after an explicit security audit, not by initial design

**Context:** An earlier build state had `CORS_ALLOWED_ORIGINS` effectively wildcard-permissive and plaintext HTTP between the Vercel frontend and the GCP backend.

**Decision (evidenced by commit sequence, not a single commit):** `bd593c0 fix: reject wildcard cors origins and pin known production origin`, `89f157c fix: drive CORS allowed origins from CORS_ALLOWED_ORIGINS env var`, `0db1445 fix: terminate tls on the backend vm instead of proxying plaintext http`, `8b81bb0 fix: run backend container as non-root user`.

**Consequences:** These are exactly the fixes recommended by `docs/SECURITY_AUDIT.md` (dated 2026-06-22) for Findings 3 and 4 — the commit history shows the audit's recommendations were acted on rather than left as a written-but-ignored report. Authentication itself (the audit's Findings 1 and 2 — no auth on any endpoint) was separately and substantially addressed by the OAuth/session/tenant work, which appears in the commit history around the same period. This is worth naming explicitly in any writeup: the security posture visibly improved in response to a documented internal audit, which is a healthier pattern than either (a) no audit ever happening, or (b) an audit whose findings are never acted on.
