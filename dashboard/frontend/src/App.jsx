import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CopilotPanel } from './components/layout/CopilotPanel'
import { HomeSection } from './components/sections/HomeSection'
import { MarketSection } from './components/sections/MarketSection'
import { PayAnalysisSection } from './components/sections/PayAnalysisSection'
import { GovernSection } from './components/sections/GovernSection'
import './App.css'

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
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
