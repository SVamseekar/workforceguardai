# Paper title alignment (issue #88, Option B)

`paper/` is listed in `.gitignore`. The live LaTeX source is **not** on
`origin/dell-sync-2026-09-05` (that branch only has `data/paper_exports/`,
`scripts/paper/`, and `docs/paper/system_description.md`). It lives on disk at:

`projects/gender-pay-gap-paper/main.tex` (also gitignored via `projects/`)

## Decision

**Option B** — 27-country panel, matching `docs/METRICS_CANONICAL.md` and the
README citation block.

Canonical `main.tex` title (already correct; no "20-Country" in the title):

> Does Labour Market Tightness Close the Gender Pay Gap? A Panel Test of a Contested Premise

Abstract already states a panel of **27 EU member states** (2019–2024).

Older drafts under `projects/gender-pay-gap-paper/drafts/` (`paper.tex`,
`paper-abstract-draft.md`, `paper-full-draft.md`) still used the 20-country
title/abstract; those were retitled to **27-Country** / 27-member-state wording
and r ≈ +0.44 in this pass. They remain gitignored.

## MPRA 129330

External listing may still show the old 20-country title. Author correction on
mpra.ub.uni-muenchen.de is a manual step.

## Self-description

The paper describes itself as a working paper / preprint. Do not call it
peer-reviewed.
