/**
 * Normalizes the /api/overview response to the shape the frontend components expect.
 * The backend API uses different key names than the original frontend spec assumed.
 * All mapping lives here — components read the normalized shape only.
 */

type AnyObj = Record<string, unknown>

function asObj(v: unknown): AnyObj {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v as AnyObj : {}
}

function asArr(v: unknown): AnyObj[] {
  return Array.isArray(v) ? v as AnyObj[] : []
}

function metricTone(metric: AnyObj): string {
  const comps = asObj(metric.comparisons)
  const pp = asObj(comps.prior_period)
  return (pp.tone as string) ?? 'neutral'
}

function metricDelta(metric: AnyObj): number | null {
  const comps = asObj(metric.comparisons)
  const pp = asObj(comps.prior_period)
  return pp.delta != null ? Number(pp.delta) : (metric.delta != null ? Number(metric.delta) : null)
}

export function normalizeOverview(raw: unknown): AnyObj {
  if (!raw || typeof raw !== 'object') return {}
  const d = raw as AnyObj

  // ── metrics: add top-level tone + delta derived from comparisons.prior_period
  const metrics = asArr(d.metrics).map((m) => ({
    ...m,
    tone: m.tone ?? metricTone(m),
    delta: m.delta ?? metricDelta(m),
  }))

  // ── filters.options: normalize key names
  const filtersRaw = asObj(d.filters)
  const optsRaw = asObj(filtersRaw.options)
  const options = {
    ...optsRaw,
    countries: asArr(optsRaw.countries ?? optsRaw.country_options),
    sectors: asArr(optsRaw.sectors ?? optsRaw.sector_options),
    periods: asArr(optsRaw.periods ?? optsRaw.period_options),
    benchmark_geographies: asArr(optsRaw.benchmark_geographies ?? optsRaw.geography_options),
  }
  const filters = { ...filtersRaw, options }

  // ── brief: flatten summary.headline / summary.body
  const briefRaw = asObj(d.brief)
  const briefSummary = asObj(briefRaw.summary)
  const brief = {
    ...briefRaw,
    headline: briefRaw.headline ?? briefSummary.headline ?? briefRaw.title,
    summary: briefSummary.body ?? briefRaw.summary ?? briefRaw.title,
  }

  // ── intelligence.signals: map detail→summary, evidence_bundle→evidence
  const intelRaw = asObj(d.intelligence)
  const signals = asArr(intelRaw.signals).map((s) => ({
    ...s,
    summary: s.summary ?? s.detail,
    evidence: s.evidence ?? s.evidence_bundle,
  }))
  const intelligence = { ...intelRaw, signals }

  // ── governance: logged_events→events, available_actions key normalization
  const govRaw = asObj(d.governance)
  const loggedEvents = asArr(govRaw.logged_events ?? govRaw.events ?? govRaw.recent_events)
  const availableActions = asArr(govRaw.available_actions).map((a) => ({
    ...a,
    code: a.code ?? a.action_code,
    label: a.label ?? a.action_name,
  }))
  const governance = { ...govRaw, logged_events: loggedEvents, available_actions: availableActions }

  // ── automation: scheduled_workflows→scheduled_briefs, pending_handoffs→handoffs
  const autoRaw = asObj(d.automation)
  const scheduledWorkflows = asArr(autoRaw.scheduled_workflows ?? autoRaw.scheduled_briefs)
  const pendingHandoffs = asArr(autoRaw.pending_handoffs ?? autoRaw.handoffs).map((h) => ({
    ...h,
    due_label: h.due_label ?? h.approval_checkpoint,
  }))
  const automation = {
    ...autoRaw,
    scheduled_workflows: scheduledWorkflows,
    pending_handoffs: pendingHandoffs,
  }

  // ── pay_transparency: categories→review_items
  const ptRaw = asObj(d.pay_transparency)
  const categories = asArr(ptRaw.categories ?? ptRaw.review_items ?? ptRaw.top_review_items)
  const pay_transparency = { ...ptRaw, categories }

  return {
    ...d,
    metrics,
    filters,
    brief,
    intelligence,
    governance,
    automation,
    pay_transparency,
  }
}
