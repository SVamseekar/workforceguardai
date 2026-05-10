# Frontend Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Vitest + React Testing Library + MSW and write ~25 behaviour-focused tests covering the `useOverviewData` hook, all four section components, `FilterBar`, and a copy-standard guard — all running fully offline with no backend required.

**Architecture:** Vitest runs inside Vite's native ESM pipeline (no Babel, no extra config). MSW intercepts axios calls at the HTTP boundary in Node via `msw/node` `setupServer`, so the actual hook/component code runs unchanged. A shared `handlers.js` file defines fake API responses reused across all test files. Tests are co-located under `src/__tests__/` grouped by concern.

**Tech Stack:** Vitest 3, @testing-library/react 16, @testing-library/user-event 14, msw 2, @testing-library/jest-dom 6, jsdom

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `src/__tests__/setup.js` | Global test setup: jest-dom matchers, MSW server lifecycle |
| `src/__tests__/handlers.js` | MSW request handlers — fake responses for all API endpoints |
| `src/__tests__/hooks/useOverviewData.test.js` | Hook behaviour: fetch, URL sync, uploadPayroll, exportEvidencePack, recordGovernanceAction, error paths |
| `src/__tests__/sections/HomeSection.test.jsx` | Renders metric cards, attention items, executive brief |
| `src/__tests__/sections/MarketSection.test.jsx` | Renders filter bar, 4 chart panels, signals list |
| `src/__tests__/sections/PayAnalysisSection.test.jsx` | Renders compliance table with HR copy, demo notice |
| `src/__tests__/sections/GovernSection.test.jsx` | Renders "Reviewed by" column, evidence pack button |
| `src/__tests__/shared/FilterBar.test.jsx` | Dropdowns render correct labels, calls onFilterChange |
| `src/__tests__/copy-standards.test.jsx` | Backend terms never appear in rendered DOM |

### Files to modify
| File | Change |
|------|--------|
| `vite.config.js` | Add `test` block: environment jsdom, setupFiles, globals |
| `package.json` | Add devDependencies + `"test"` script |

---

## Shared mock overview payload

All section tests use this payload. It is defined once in `handlers.js` and referenced everywhere.

```js
// The shape matches what the real /api/overview endpoint returns.
// Enough fields to exercise every section — keep it minimal.
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
  brief: { headline: 'Labour market stable with vacancy pressure', summary: 'Overall conditions remain stable. Vacancy rate in manufacturing warrants attention.' },
  company_benchmark: { available: false, note: 'No company data loaded.' },
  internal_data: { available: false, note: 'No internal data.' },
  semantic_metrics: [],
  pay_transparency: { available: false },
  egapro_peer_benchmark: { available: false },
  governance: { logged_events: [], available_actions: [] },
  automation: { scheduled_workflows: [], pending_handoffs: [] },
  comparisons: { targets: {} },
}
```

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/__tests__/setup.js`

- [ ] **Step 1: Install test dependencies**

```bash
cd dashboard/frontend
npm install --save-dev vitest@3 @testing-library/react@16 @testing-library/user-event@14 @testing-library/jest-dom@6 msw@2 jsdom@26
```

Expected: packages added with no errors.

- [ ] **Step 2: Add test script to package.json**

In `dashboard/frontend/package.json`, add to the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add Vitest config block to vite.config.js**

Add a `test` key inside the `return { ... }` object in `vite.config.js`, alongside `plugins`, `server`, and `build`:

```js
test: {
  environment: 'jsdom',
  setupFiles: ['./src/__tests__/setup.js'],
  globals: true,
},
```

Full updated `vite.config.js`:

```js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/health': { target: proxyTarget, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ['recharts'],
            icons: ['lucide-react'],
            network: ['axios'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/__tests__/setup.js'],
      globals: true,
    },
  }
})
```

- [ ] **Step 4: Create src/__tests__/setup.js**

```js
import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './handlers.js'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 5: Verify Vitest is wired correctly**

Create a temporary smoke test `src/__tests__/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run:
```bash
cd dashboard/frontend && npm test
```

Expected output: `1 passed`. Delete the smoke test file after it passes.

- [ ] **Step 6: Commit**

```bash
cd dashboard/frontend
git add package.json vite.config.js src/__tests__/setup.js
git commit -m "feat: add Vitest + RTL + MSW test infrastructure"
```

---

## Task 2: Create MSW handlers

**Files:**
- Create: `src/__tests__/handlers.js`

- [ ] **Step 1: Create src/__tests__/handlers.js**

```js
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
  brief: { headline: 'Labour market stable with vacancy pressure', summary: 'Overall conditions remain stable.' },
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
]

export const server = setupServer(...handlers)
```

- [ ] **Step 2: Run tests to confirm handlers load without error**

```bash
cd dashboard/frontend && npm test
```

Expected: 0 failed (only the smoke test or none if deleted).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/handlers.js
git commit -m "feat: add MSW handlers with shared mock overview payload"
```

---

## Task 3: Test useOverviewData hook

**Files:**
- Create: `src/__tests__/hooks/useOverviewData.test.js`

This hook uses `useSearchParams` which requires a router context. We wrap every `renderHook` call with a `MemoryRouter` wrapper.

- [ ] **Step 1: Create src/__tests__/hooks/useOverviewData.test.js**

```js
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { useOverviewData } from '../../hooks/useOverviewData.js'

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>

describe('useOverviewData', () => {
  it('fetches overview on mount and sets loading false when done', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.overview).not.toBeNull()
    expect(result.current.overview.metrics).toHaveLength(2)
    expect(result.current.error).toBe('')
  })

  it('sets error message when API returns 500', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe(
      'The API hit an internal error. Try a different filter state or check the backend logs.',
    )
    expect(result.current.overview).toBeNull()
  })

  it('sets error message when API is unreachable', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.error()),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toMatch(/Could not reach/)
  })

  it('uploadPayroll posts file and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const file = new File(['emp_id,salary\n1,50000'], 'payroll.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.uploadPayroll(file)
    })

    expect(result.current.notice).toEqual({
      type: 'success',
      message: 'Upload accepted — 42 employees loaded.',
    })
  })

  it('uploadPayroll shows error notice on failure', async () => {
    server.use(
      http.post('/api/upload/payroll', () =>
        HttpResponse.json({ detail: 'Invalid columns.' }, { status: 422 }),
      ),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.uploadPayroll(file)
    })

    expect(result.current.notice).toEqual({
      type: 'error',
      message: 'Invalid columns.',
    })
  })

  it('recordGovernanceAction posts event and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.recordGovernanceAction('approved', 'pay_category', 'cat-1')
    })

    expect(result.current.notice).toEqual({
      type: 'success',
      message: 'Decision recorded.',
    })
  })

  it('exportEvidencePack triggers download link and does not set error', async () => {
    // jsdom does not implement URL.createObjectURL — stub it
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    // Stub link.click so jsdom does not throw
    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.exportEvidencePack()
    })

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(result.current.notice).toBeNull()

    vi.restoreAllMocks()
  })

  it('scheduleBrief posts schedule and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.scheduleBrief({ id: 'weekly-brief', label: 'Weekly brief' })
    })

    expect(result.current.notice).toEqual({
      type: 'success',
      message: 'Workflow "Weekly brief" scheduled.',
    })
  })
})
```

- [ ] **Step 2: Run the hook tests**

```bash
cd dashboard/frontend && npm test src/__tests__/hooks/useOverviewData.test.js
```

Expected: `7 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/hooks/useOverviewData.test.js
git commit -m "test: add useOverviewData hook tests"
```

---

## Task 4: Test HomeSection

**Files:**
- Create: `src/__tests__/sections/HomeSection.test.jsx`

- [ ] **Step 1: Create src/__tests__/sections/HomeSection.test.jsx**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { HomeSection } from '../../components/sections/HomeSection.jsx'

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('HomeSection', () => {
  it('shows loading state initially', () => {
    renderInRouter(<HomeSection />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders Command Centre heading after data loads', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() => expect(screen.getByText('Command Centre')).toBeInTheDocument())
  })

  it('renders a metric card for each metric in the response', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() => {
      expect(screen.getByText('Unemployment rate')).toBeInTheDocument()
      expect(screen.getByText('Employment rate')).toBeInTheDocument()
    })
  })

  it('renders Executive Brief section with headline', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Labour market stable with vacancy pressure')).toBeInTheDocument(),
    )
    expect(screen.getByText('Executive Brief')).toBeInTheDocument()
  })

  it('shows Needs Attention section when watch signals exist', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Needs Attention')).toBeInTheDocument(),
    )
    expect(screen.getByText('Vacancy rate rising in manufacturing')).toBeInTheDocument()
  })

  it('shows error panel when API fails', async () => {
    const { http, HttpResponse } = await import('msw')
    const { server } = await import('../handlers.js')
    server.use(
      http.get('/api/overview', () => HttpResponse.json({ detail: 'err' }, { status: 500 })),
    )

    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Could not load data')).toBeInTheDocument(),
    )
  })
})
```

- [ ] **Step 2: Run the section tests**

```bash
cd dashboard/frontend && npm test src/__tests__/sections/HomeSection.test.jsx
```

Expected: `6 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sections/HomeSection.test.jsx
git commit -m "test: add HomeSection behaviour tests"
```

---

## Task 5: Test MarketSection

**Files:**
- Create: `src/__tests__/sections/MarketSection.test.jsx`

- [ ] **Step 1: Create src/__tests__/sections/MarketSection.test.jsx**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { MarketSection } from '../../components/sections/MarketSection.jsx'

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('MarketSection', () => {
  it('shows loading state initially', () => {
    renderInRouter(<MarketSection />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders Market Intelligence heading after data loads', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Market Intelligence')).toBeInTheDocument())
  })

  it('renders all 4 chart panel titles', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => {
      expect(screen.getByText('Unemployment trend')).toBeInTheDocument()
      expect(screen.getByText('Vacancy rate by sector')).toBeInTheDocument()
      expect(screen.getByText('Employment trend')).toBeInTheDocument()
      expect(screen.getByText('Gender pay gap by sector')).toBeInTheDocument()
    })
  })

  it('renders Intelligence Signals section', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Intelligence Signals')).toBeInTheDocument())
    expect(screen.getByText('Vacancy rate rising in manufacturing')).toBeInTheDocument()
    expect(screen.getByText('Employment stable')).toBeInTheDocument()
  })

  it('renders Recommendations section', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Recommendations')).toBeInTheDocument())
    expect(screen.getByText('Monitor manufacturing vacancies')).toBeInTheDocument()
  })

  it('renders Watchlist section', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Watchlist')).toBeInTheDocument())
    expect(screen.getByText('Youth unemployment')).toBeInTheDocument()
  })

  it('renders filter bar with Country, Sector, Period dropdowns', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => {
      expect(screen.getByText('Country')).toBeInTheDocument()
      expect(screen.getByText('Sector')).toBeInTheDocument()
      expect(screen.getByText('Period')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd dashboard/frontend && npm test src/__tests__/sections/MarketSection.test.jsx
```

Expected: `7 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sections/MarketSection.test.jsx
git commit -m "test: add MarketSection behaviour tests"
```

---

## Task 6: Test PayAnalysisSection

**Files:**
- Create: `src/__tests__/sections/PayAnalysisSection.test.jsx`

- [ ] **Step 1: Create src/__tests__/sections/PayAnalysisSection.test.jsx**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { PayAnalysisSection } from '../../components/sections/PayAnalysisSection.jsx'

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PayAnalysisSection', () => {
  it('renders Pay Analysis heading after data loads', async () => {
    renderInRouter(<PayAnalysisSection />)
    await waitFor(() => expect(screen.getByText('Pay Analysis')).toBeInTheDocument())
  })

  it('shows "No company data loaded" chip when internal data unavailable', async () => {
    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('No company data loaded')).toBeInTheDocument(),
    )
  })

  it('shows representative example notice when internal data unavailable', async () => {
    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('Representative example')).toBeInTheDocument(),
    )
    expect(screen.getByText(/Upload your data/)).toBeInTheDocument()
  })

  it('renders compliance table when pay_transparency is available', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          internal_data: { available: true },
          pay_transparency: {
            available: true,
            summary: { unresolved_review_item_count: 1 },
            categories: [
              { id: 'cat-1', label: 'Senior engineers', gap_value: 8.2, review_state: 'unresolved_review_item', note: 'Requires review.' },
            ],
          },
          governance: {
            available_actions: [{ code: 'approved', label: 'Approve' }],
            logged_events: [],
          },
        }),
      ),
    )

    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('Pay transparency compliance')).toBeInTheDocument(),
    )
    expect(screen.getByText('Senior engineers')).toBeInTheDocument()
    expect(screen.getByText('Needs review')).toBeInTheDocument()
    expect(screen.queryByText('unresolved_review_item')).not.toBeInTheDocument()
  })

  it('renders Égapro panel when egapro_peer_benchmark is available', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          egapro_peer_benchmark: {
            available: true,
            company_count: 120,
            p25_score: 72,
            p50_score: 82,
            p75_score: 91,
            note: 'Sector: Manufacturing.',
          },
        }),
      ),
    )

    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('France Égapro Index')).toBeInTheDocument(),
    )
    expect(screen.getByText('120 companies')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd dashboard/frontend && npm test src/__tests__/sections/PayAnalysisSection.test.jsx
```

Expected: `5 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sections/PayAnalysisSection.test.jsx
git commit -m "test: add PayAnalysisSection behaviour tests"
```

---

## Task 7: Test GovernSection

**Files:**
- Create: `src/__tests__/sections/GovernSection.test.jsx`

- [ ] **Step 1: Create src/__tests__/sections/GovernSection.test.jsx**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { GovernSection } from '../../components/sections/GovernSection.jsx'

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('GovernSection', () => {
  it('renders Govern & Export heading after data loads', async () => {
    renderInRouter(<GovernSection />)
    await waitFor(() => expect(screen.getByText('Govern & Export')).toBeInTheDocument())
  })

  it('renders governance log with "Reviewed by" column header — not "Actor"', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          governance: {
            logged_events: [
              {
                action_code: 'approved',
                target_type: 'pay_category',
                target_id: 'cat-1',
                actor: 'dashboard-user',
                recorded_at: '2026-04-01T10:00:00Z',
              },
            ],
            available_actions: [],
          },
        }),
      ),
    )

    renderInRouter(<GovernSection />)
    await waitFor(() => expect(screen.getByText('Reviewed by')).toBeInTheDocument())
    expect(screen.queryByRole('columnheader', { name: 'Actor' })).not.toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows empty state message when no events logged', async () => {
    renderInRouter(<GovernSection />)
    await waitFor(() =>
      expect(screen.getByText(/No decisions logged yet/)).toBeInTheDocument(),
    )
  })

  it('renders evidence pack download button', async () => {
    renderInRouter(<GovernSection />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Download Evidence Pack/i })).toBeInTheDocument(),
    )
  })

  it('renders workflow automation section when workflows exist', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          automation: {
            scheduled_workflows: [{ id: 'wf-1', label: 'Weekly brief', status: 'active' }],
            pending_handoffs: [],
          },
        }),
      ),
    )

    renderInRouter(<GovernSection />)
    await waitFor(() => expect(screen.getByText('Scheduled workflows')).toBeInTheDocument())
    expect(screen.getByText('Weekly brief')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run now/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd dashboard/frontend && npm test src/__tests__/sections/GovernSection.test.jsx
```

Expected: `5 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sections/GovernSection.test.jsx
git commit -m "test: add GovernSection behaviour tests"
```

---

## Task 8: Test FilterBar

**Files:**
- Create: `src/__tests__/shared/FilterBar.test.jsx`

- [ ] **Step 1: Create src/__tests__/shared/FilterBar.test.jsx**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '../../components/shared/FilterBar.jsx'

const DEFAULT_FILTERS = {
  country: 'ALL',
  sector: 'ALL',
  period: 'latest',
  benchmark_geography: '',
  benchmark_sector: '',
}

const DEFAULT_OPTIONS = {
  countries: [{ id: 'FR', label: 'France' }, { id: 'DE', label: 'Germany' }],
  sectors: [{ id: 'C', label: 'Manufacturing' }],
  periods: [{ id: 'latest', label: 'Latest' }, { id: '2023', label: '2023' }],
  benchmark_geographies: [],
}

describe('FilterBar', () => {
  it('renders Country, Sector, Period labels', () => {
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Sector')).toBeInTheDocument()
    expect(screen.getByText('Period')).toBeInTheDocument()
  })

  it('does not render "Compare against" when benchmark_geographies is empty', () => {
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.queryByText('Compare against')).not.toBeInTheDocument()
  })

  it('renders "Compare against" label — not "benchmark_geography" — when options provided', () => {
    const optionsWithBenchmark = {
      ...DEFAULT_OPTIONS,
      benchmark_geographies: [{ id: 'DE', label: 'Germany' }, { id: 'FR', label: 'France' }],
    }

    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={optionsWithBenchmark}
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Compare against')).toBeInTheDocument()
    expect(screen.queryByText('benchmark_geography')).not.toBeInTheDocument()
  })

  it('calls onFilterChange with updated country when country select changes', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()

    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={onFilterChange}
      />,
    )

    const countrySelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(countrySelect, 'FR')

    expect(onFilterChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, country: 'FR' })
  })

  it('calls onFilterChange with updated period when period select changes', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()

    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={onFilterChange}
      />,
    )

    const periodSelect = screen.getAllByRole('combobox')[2]
    await user.selectOptions(periodSelect, '2023')

    expect(onFilterChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, period: '2023' })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd dashboard/frontend && npm test src/__tests__/shared/FilterBar.test.jsx
```

Expected: `5 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/shared/FilterBar.test.jsx
git commit -m "test: add FilterBar behaviour tests"
```

---

## Task 9: Copy standards guard

**Files:**
- Create: `src/__tests__/copy-standards.test.jsx`

This is the highest-ROI test in the suite. It renders every section and asserts that raw backend terms never appear in the DOM.

- [ ] **Step 1: Create src/__tests__/copy-standards.test.jsx**

```jsx
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from './handlers.js'
import { HomeSection } from '../components/sections/HomeSection.jsx'
import { MarketSection } from '../components/sections/MarketSection.jsx'
import { PayAnalysisSection } from '../components/sections/PayAnalysisSection.jsx'
import { GovernSection } from '../components/sections/GovernSection.jsx'

// Backend terms that must NEVER appear as visible text in the UI.
// These are internal identifiers — the UI must always translate them.
const BANNED_TERMS = [
  'observed_gap',
  'unresolved_review_item',
  'justified_difference',
  'internal mart active',
  'internal mart inactive',
  'external-only answers',
  'evidence_basis',
  'snapshot_date',
  'source_id',
  'eurostat_lfs',
  'eurostat_jvs',
  'eurostat_ses',
]

// Render with data that would expose these terms if the translation layer breaks.
const RICH_OVERVIEW = {
  ...MOCK_OVERVIEW,
  internal_data: { available: true, note: 'internal mart active' },
  company_benchmark: {
    available: true,
    internal_value: 11.2,
    market_value: 13.4,
    female_count: 120,
    male_count: 130,
    headcount: 250,
    confidence: 'low',
    coverage_status: 'partial',
    evidence_basis: 'blended',
    snapshot_date: '2024-12-31',
    delta_label: '2.2 pts below market',
    worker_category: { label: 'All employees' },
    note: 'Blended basis.',
  },
  pay_transparency: {
    available: true,
    summary: { unresolved_review_item_count: 1 },
    categories: [
      { id: 'cat-1', label: 'Senior engineers', gap_value: 8.2, review_state: 'unresolved_review_item', note: '' },
      { id: 'cat-2', label: 'Junior staff', gap_value: 2.1, review_state: 'justified_difference', note: '' },
    ],
  },
  governance: {
    logged_events: [
      { action_code: 'approved', target_type: 'pay_category', target_id: 'cat-1', actor: 'dashboard-user', recorded_at: '2026-04-01T10:00:00Z' },
    ],
    available_actions: [],
  },
}

function renderSection(Section) {
  const { container } = render(
    <MemoryRouter>
      <Section />
    </MemoryRouter>,
  )
  return container
}

describe('Copy standards — no backend terms in user-facing text', () => {
  beforeEach(() => {
    server.use(http.get('/api/overview', () => HttpResponse.json(RICH_OVERVIEW)))
  })

  for (const Section of [HomeSection, MarketSection, PayAnalysisSection, GovernSection]) {
    it(`${Section.name}: renders without exposing backend terms`, async () => {
      const container = renderSection(Section)

      await waitFor(() => {
        // Wait for loading to finish — any section-specific heading suffices
        const text = container.textContent ?? ''
        expect(text).not.toMatch(/Loading…/)
      })

      const text = container.textContent ?? ''

      for (const term of BANNED_TERMS) {
        expect(text, `"${term}" found in ${Section.name} output`).not.toContain(term)
      }
    })
  }
})
```

- [ ] **Step 2: Run the copy standards tests**

```bash
cd dashboard/frontend && npm test src/__tests__/copy-standards.test.jsx
```

Expected: `4 passed` (one per section).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/copy-standards.test.jsx
git commit -m "test: add copy-standards guard — backend terms must not appear in UI"
```

---

## Task 10: Full suite run and verification

- [ ] **Step 1: Run full test suite**

```bash
cd dashboard/frontend && npm test
```

Expected output: all tests pass, no failures. Count should be approximately:
- `useOverviewData.test.js` — 7 tests
- `HomeSection.test.jsx` — 6 tests
- `MarketSection.test.jsx` — 7 tests
- `PayAnalysisSection.test.jsx` — 5 tests
- `GovernSection.test.jsx` — 5 tests
- `FilterBar.test.jsx` — 5 tests
- `copy-standards.test.jsx` — 4 tests

**Total: ~39 tests, 0 failed.**

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: `✓ built in N seconds`, no errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test: frontend test suite complete — 39 tests, 0 failed"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| Vitest + RTL + MSW installed | Task 1 |
| Fully offline — no backend needed | MSW intercepts all requests in Tasks 2–9 |
| `useOverviewData` hook tested | Task 3 — 7 tests covering fetch, errors, uploadPayroll, exportEvidencePack, recordGovernanceAction, scheduleBrief |
| Section smoke tests (all 4) | Tasks 4–7 |
| `FilterBar` labels and interactions | Task 8 |
| Copy standards guard | Task 9 |
| "Reviewed by" not "Actor" | Task 7, test 2 |
| "Needs review" not "unresolved_review_item" | Task 9 (copy guard) + Task 6 (compliance table) |
| "Compare against" not "benchmark_geography" | Task 8, test 3 |
| Build still passes after adding tests | Task 10 |

All requirements covered.

### Placeholder scan
No TBD, TODO, or vague steps. All test code is complete and runnable.

### Type consistency
- `MOCK_OVERVIEW` shape defined once in `handlers.js`, imported by all test files — no duplication
- `renderInRouter` helper defined per test file (not shared) to keep files independently readable
- `server.use(...)` pattern used consistently for per-test handler overrides in Tasks 3–9
