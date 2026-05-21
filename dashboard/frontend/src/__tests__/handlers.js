import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const MOCK_OVERVIEW = {
  metrics: [
    { id: 'unemployment', title: 'Unemployment rate', value: 6.2, delta: -0.4, unit: '%', tone: 'good', period: 'Q4 2024', provenance: [{ source_id: 'eurostat_lfs' }] },
    { id: 'employment', title: 'Employment rate', value: 73.1, delta: 0.8, unit: '%', tone: 'good', period: 'Q4 2024', provenance: [{ source_id: 'eurostat_lfs' }] },
  ],
  filters: {
    applied: { country: 'ALL', geography: 'EU27_AVG', sector: 'ALL', period: 'latest' },
    options: {
      countries: [{ id: 'FR', label: 'France' }, { id: 'DE', label: 'Germany' }],
      sectors: [{ id: 'C', label: 'Manufacturing' }],
      periods: [{ id: 'latest', label: 'Latest' }, { id: '2023', label: '2023' }],
      benchmark_geographies: [],
    },
  },
  charts: {
    unemployment_trend: { series: [{ period: '2022-Q1', value: 7.1 }, { period: '2022-Q2', value: 6.8 }] },
    employment_trend: { series: [{ period: '2022-Q1', value: 72.0 }, { period: '2022-Q2', value: 72.5 }] },
    vacancy_by_sector: { series: [{ sector_label: 'Manufacturing', value: 2.1 }] },
    pay_gap_by_sector: { series: [{ sector_label: 'Manufacturing', value: 13.4 }] },
  },
  intelligence: {
    signals: [
      { title: 'Vacancy rate rising in manufacturing', tone: 'watch', summary: 'Vacancies up 0.4 pts YoY.' },
      { title: 'Employment stable', tone: 'good', summary: 'Employment broadly stable.' },
    ],
    recommendations: [{ title: 'Monitor manufacturing vacancies', priority: 'high', summary: 'Consider pipeline review.' }],
    watchlist: [{ label: 'Youth unemployment', tone: 'watch', summary: 'Elevated vs EU average.' }],
  },
  brief: { headline: 'Labour market stable with vacancy pressure', summary: { headline: 'Labour market stable with vacancy pressure', body: 'Overall conditions remain stable.' } },
  company_benchmark: { available: false, note: 'No company data loaded.' },
  internal_data: { available: false, note: 'No internal data.' },
  semantic_metrics: [],
  pay_transparency: { available: false },
  egapro_peer_benchmark: { available: false },
  governance: { logged_events: [], available_actions: [] },
  automation: { scheduled_workflows: [], pending_handoffs: [] },
  comparisons: { targets: {} },
}

export const handlers = [
  http.get('/api/overview', () => HttpResponse.json(MOCK_OVERVIEW)),

  http.post('/api/ask', () =>
    HttpResponse.json({ answer: 'Unemployment is 6.2%.', follow_ups: ['What changed?'] }),
  ),

  http.get('/api/evidence-pack', () =>
    HttpResponse.json({ metrics: [], governance: [] }),
  ),

  http.post('/api/governance-events', () =>
    HttpResponse.json({ ok: true }),
  ),

  http.post('/api/automation/schedules', () =>
    HttpResponse.json({ id: 'sched-1', label: 'Weekly brief' }),
  ),

  http.post('/api/upload/payroll', () =>
    HttpResponse.json({ record_count: 42, status: 'accepted' }),
  ),

  http.get('/api/freshness', () =>
    HttpResponse.json({ pulled_at: '2026-05-11T02:00:00Z', source_label: 'Eurostat' }),
  ),
]

export const server = setupServer(...handlers)
