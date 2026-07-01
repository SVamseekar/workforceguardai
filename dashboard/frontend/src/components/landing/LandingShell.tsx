import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { LogoMark } from '../shared/LogoMark'
import { SupportEmailLink } from './components/SupportEmailLink'
import { NAV_LINKS, openContactForm } from './site'

type LandingDemoContextValue = {
  openDemo: () => void
}

const LandingDemoContext = createContext<LandingDemoContextValue>({
  openDemo: () => {},
})

export function useLandingDemo() {
  return useContext(LandingDemoContext)
}

type LandingShellProps = {
  children: ReactNode
}

export function LandingShell({ children }: LandingShellProps) {
  const location = useLocation()
  const onHome = location.pathname === '/'
  const hashPrefix = onHome ? '' : '/'

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [navOpen, setNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  const closeNav = () => setNavOpen(false)
  const openDemo = () => {
    closeNav()
    openContactForm()
  }

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg__mesh" />
        <div className="landing-bg__grid" />
      </div>

      <header ref={navRef} className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-nav__inner">
          <Link to="/" className="landing-nav__brand" onClick={closeNav}>
            <LogoMark size={38} className="landing-nav__logo" />
            <span className="landing-nav__wordmark">WorkforceGuard AI</span>
          </Link>

          <nav className="landing-nav__links" aria-label="Primary">
            {NAV_LINKS.map((link) =>
              link.kind === 'route' ? (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={location.pathname === link.to ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ) : (
                <a key={link.hash} href={`${hashPrefix}${link.hash}`}>
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="landing-nav__actions">
            <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link
              to="/app"
              className="landing-cta landing-nav__cta landing-nav__cta--signin"
              title="Organisation sign-in via Google or Microsoft"
            >
              Sign in
            </Link>
            <button
              type="button"
              className="landing-cta landing-cta--primary landing-nav__cta"
              onClick={openDemo}
            >
              Request a demo
            </button>
            <button
              className="landing-nav__menu-btn"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
            >
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <div className={`landing-mobile-nav ${navOpen ? 'is-open' : ''}`} aria-hidden={!navOpen}>
        <nav aria-label="Mobile">
          {NAV_LINKS.map((link) =>
            link.kind === 'route' ? (
              <Link key={link.to} to={link.to} onClick={closeNav}>
                {link.label}
              </Link>
            ) : (
              <a key={link.hash} href={`${hashPrefix}${link.hash}`} onClick={closeNav}>
                {link.label}
              </a>
            ),
          )}
          <Link
            to="/app"
            className="landing-cta landing-nav__cta--signin"
            onClick={closeNav}
            title="Organisation sign-in via Google or Microsoft"
          >
            Sign in to dashboard
          </Link>
          <button type="button" className="landing-cta landing-cta--primary" onClick={openDemo}>
            Request a demo
          </button>
        </nav>
      </div>

      <LandingDemoContext.Provider value={{ openDemo }}>{children}</LandingDemoContext.Provider>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <Link to="/" className="landing-nav__brand">
              <LogoMark size={28} className="landing-nav__logo" />
              <span>WorkforceGuard AI</span>
            </Link>
            <p>
              EU workforce intelligence and pay-transparency compliance for HR, people analytics,
              and compliance teams.
            </p>
            <p className="landing-footer__email">
              <SupportEmailLink />
            </p>
          </div>
          <div className="landing-footer__cols">
            <div>
              <h4>Product</h4>
              <nav>
                <Link to="/app">Dashboard</Link>
                <Link to="/app/market">Market Intelligence</Link>
                <Link to="/app/pay-analysis">Pay Analysis</Link>
                <Link to="/app/govern">Governance</Link>
              </nav>
            </div>
            <div>
              <h4>Resources</h4>
              <nav>
                <Link to="/mission">Our mission</Link>
                <a href="/#compliance">Compliance mapping</a>
                <a href="/#research">Research</a>
                <a href="/#faq">FAQ</a>
                <a href="/#contact">Contact</a>
                <Link to="/privacy">Privacy Policy</Link>
                <a href="https://github.com/SVamseekar/workforceguardai" target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </nav>
            </div>
          </div>
        </div>
        <div className="landing-footer__legal">
          <p>
            WorkforceGuard AI is an analytics and evidence platform. It does not provide legal advice;
            consult qualified counsel for compliance determinations under Directive (EU) 2023/970.
          </p>
        </div>
      </footer>
    </div>
  )
}
