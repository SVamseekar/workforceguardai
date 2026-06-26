import { useState, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CopilotPanel } from './components/layout/CopilotPanel'
import { HomeSection } from './components/sections/HomeSection'
import { MarketSection } from './components/sections/MarketSection'
import { PayAnalysisSection } from './components/sections/PayAnalysisSection'
import { GovernSection } from './components/sections/GovernSection'
import { CompareSection } from './components/sections/CompareSection'
import { LandingPage } from './components/landing/LandingPage'
import { MissionPage } from './components/landing/MissionPage'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { LoginScreen } from './components/auth/LoginScreen'
import { NoticeBar } from './components/shared/NoticeBar'
import { SidebarContext } from './components/layout/SidebarContext'
import { useOverviewData } from './hooks/useOverviewData'
import { GoogleAnalytics } from './components/GoogleAnalytics'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
})

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const { overview } = useOverviewData()
  const ov = (overview ?? {}) as Record<string, unknown>
  const intel = (ov.intelligence as Record<string, unknown>) ?? {}
  const signals = (intel.signals as Array<Record<string, unknown>>) ?? []
  const govRaw = (ov.governance as Record<string, unknown>) ?? {}
  const integrity = (govRaw.integrity as Record<string, unknown>) ?? {}
  const appliedFilters = ((ov.filters as Record<string, unknown>)?.applied as Record<string, unknown>) ?? {}

  const topSignal = signals[0]
    ? { title: signals[0].title as string, tone: signals[0].tone as string, detail: (signals[0].summary as string) ?? '' }
    : null

  return (
    <SidebarContext.Provider value={{
      geographyLabel: (appliedFilters.geography_label as string) ?? '',
      topSignal,
      governanceEventCount: (integrity.event_count as number) ?? 0,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-loading">Loading…</div>
  if (!user) return <LoginScreen />
  return <DashboardShell />
}

function DashboardShell() {
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  return (
    <div className="app-shell">
      <TopBar theme={theme} onToggleTheme={toggleTheme} />
      <div className="app-body">
        <SidebarProvider>
          <Sidebar onCopilotOpen={() => setCopilotOpen(true)} />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomeSection />} />
              <Route path="/market" element={<MarketSection />} />
              <Route path="/compare" element={<CompareSection />} />
              <Route path="/pay-analysis" element={<PayAnalysisSection />} />
              <Route path="/govern" element={<GovernSection />} />
            </Routes>
          </main>
        </SidebarProvider>
      </div>
      {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
      <NoticeBar />
    </div>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/mission" element={<MissionPage />} />
            <Route
              path="/app/*"
              element={
                <AuthProvider>
                  <AuthGate />
                </AuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
        <GoogleAnalytics />
      </QueryClientProvider>
    </HelmetProvider>
  )
}
