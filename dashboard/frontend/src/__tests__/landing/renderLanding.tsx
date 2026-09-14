import { render } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Routes } from 'react-router-dom'
import { LANDING_ROUTE_ELEMENTS } from '../../components/landing/landingRoutes'

export function renderLanding(initialEntry = '/') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>{LANDING_ROUTE_ELEMENTS}</Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}
