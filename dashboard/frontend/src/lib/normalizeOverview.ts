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

  // ── metrics: add top-level tone + delta + gap_label derived from comparisons.prior_period
  const metrics = asArr(d.metrics).map((m) => {
    const pp = asObj(asObj(m.comparisons).prior_period)
    return {
      ...m,
      tone: m.tone ?? metricTone(m),
      delta: m.delta ?? metricDelta(m),
      // gap_label is the human-readable delta string from the API e.g. "0.5 pts above"
      gap_label: m.gap_label ?? pp.gap_label,
      // period_label: a cleaner period string e.g. "2024" or "Q3 2025"
      period_label: m.period_label ?? (() => {
        const p = m.period as string | undefined
        if (!p) return ''
        // Convert "2025-Q3" → "Q3 2025", leave "2024" as-is
        return p.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
      })(),
    }
  })

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

  // ── intelligence: normalize signals, recommendations, watchlist field names
  const intelRaw = asObj(d.intelligence)
  const signals = asArr(intelRaw.signals).map((s) => ({
    ...s,
    summary: s.summary ?? s.detail,
    evidence: s.evidence ?? s.evidence_bundle,
  }))
  const recommendations = asArr(intelRaw.recommendations).map((r) => ({
    ...r,
    summary: r.summary ?? r.detail,
  }))
  const watchlist = asArr(intelRaw.watchlist).map((w) => ({
    ...w,
    summary: w.summary ?? w.detail,
  }))
  const intelligence = { ...intelRaw, signals, recommendations, watchlist }

  // ── governance: logged_events→events, normalize event and action field names
  const govRaw = asObj(d.governance)
  const loggedEvents = asArr(govRaw.logged_events ?? govRaw.events ?? govRaw.recent_events).map((e) => ({
    ...e,
    // Normalize field names the UI reads
    action_code: e.action_code,
    action_label: e.action_label ?? e.action_name
      ?? (typeof e.action_code === 'string'
        ? e.action_code.charAt(0).toUpperCase() + e.action_code.slice(1).replace(/_/g, ' ')
        : e.action_code),
    recorded_at: e.recorded_at ?? e.created_at,
    // Clean up target_id into a readable label based on target_type
    target_label: e.target_label ?? (() => {
      const id = e.target_id as string | undefined
      const type = e.target_type as string | undefined
      if (!id) return e.target_type
      if (type === 'pay_category' || type === 'pay_transparency_category') {
        // "pay_transparency_category_review:eng_senior" → "Engineering Senior"
        const key = id.replace(/^pay_transparency_category_review:/, '').replace(/_/g, ' ')
        return key.charAt(0).toUpperCase() + key.slice(1)
      }
      if (type === 'automation_schedule') {
        // "weekly_executive_update::ALL::EU27_AVG::ALL::latest" → just the template label
        return id.split('::')[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
      if (type === 'evidence_pack') {
        return 'Evidence pack'
      }
      // fallback: humanise the raw id
      return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    })(),
  }))
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

  // ── pay_transparency: categories→review_items, normalize item field names
  const ptRaw = asObj(d.pay_transparency)
  const rawCategories = asArr(ptRaw.categories ?? ptRaw.review_items ?? ptRaw.top_review_items)
  const categories = rawCategories.map((cat) => ({
    ...cat,
    label: cat.label ?? asObj(cat.worker_category).label,
    gap_value: cat.gap_value ?? cat.internal_gap,
    note: cat.note ?? cat.rationale,
    // governance target id for action recording
    id: cat.id ?? asObj(cat.governance_target).target_id,
  }))
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
