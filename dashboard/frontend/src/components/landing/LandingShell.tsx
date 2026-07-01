import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { LogoMark } from '../shared/LogoMark'
import { CookieConsent } from './components/CookieConsent'
import { SupportEmailLink } from './components/SupportEmailLink'
import { useHashNavigation } from './hooks/useHashNavigation'
import { NAV_LINKS, openContactForm } from './site'

type LandingDemoContextValue = {
  openDemo: () => void
  goToHash: (hash: string) => void
}

const LandingDemoContext = createContext<LandingDemoContextValue>({
  openDemo: () => {},
  goToHash: () => {},
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

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [navOpen, setNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  const closeNav = () => setNavOpen(false)
  const { goToHash } = useHashNavigation(closeNav)

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
  const openDemo = () => {
    closeNav()
    openContactForm()
  }

  const handleHashClick = (event: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    event.preventDefault()
    goToHash(hash)
  }

  const hashHref = (hash: string) => (onHome ? hash : `/${hash}`)

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
                <a
                  key={link.hash}
                  href={hashHref(link.hash)}
                  onClick={(e) => handleHashClick(e, link.hash)}
                >
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
              <a
                key={link.hash}
                href={hashHref(link.hash)}
                onClick={(e) => handleHashClick(e, link.hash)}
              >
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

      <LandingDemoContext.Provider value={{ openDemo, goToHash }}>{children}</LandingDemoContext.Provider>

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
                <a href={hashHref('#product-tour')} onClick={(e) => handleHashClick(e, '#product-tour')}>Product tour</a>
                <a href={hashHref('#compliance')} onClick={(e) => handleHashClick(e, '#compliance')}>Compliance mapping</a>
                <a href={hashHref('#demo')} onClick={(e) => handleHashClick(e, '#demo')}>See it live</a>
                <Link to="/app">Dashboard</Link>
              </nav>
            </div>
            <div>
              <h4>More</h4>
              <nav>
                <Link to="/mission">Mission</Link>
                <a href={hashHref('#onboarding')} onClick={(e) => handleHashClick(e, '#onboarding')}>Onboarding &amp; support</a>
                <a href={hashHref('#research')} onClick={(e) => handleHashClick(e, '#research')}>Research</a>
                <a href="https://github.com/SVamseekar/workforceguardai" target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </nav>
            </div>
            <div>
              <h4>Get started</h4>
              <nav>
                <a href={hashHref('#contact')} onClick={(e) => handleHashClick(e, '#contact')}>Get in touch</a>
                <a href={hashHref('#faq')} onClick={(e) => handleHashClick(e, '#faq')}>FAQ</a>
                <button type="button" className="landing-footer__link-btn" onClick={openDemo}>
                  Request a demo
                </button>
              </nav>
            </div>
            <div>
              <h4>Legal</h4>
              <nav>
                <Link to="/privacy">Privacy Policy</Link>
              </nav>
            </div>
          </div>
        </div>
      </footer>

      <CookieConsent />
    </div>
  )
}
