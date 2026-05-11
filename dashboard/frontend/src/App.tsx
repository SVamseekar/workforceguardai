import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CopilotPanel } from './components/layout/CopilotPanel'
import { HomeSection } from './components/sections/HomeSection'
import { MarketSection } from './components/sections/MarketSection'
import { PayAnalysisSection } from './components/sections/PayAnalysisSection'
import { GovernSection } from './components/sections/GovernSection'
import { CompareSection } from './components/sections/CompareSection'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
})

function AppShell() {
  const [copilotOpen, setCopilotOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
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
      </div>
      {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
