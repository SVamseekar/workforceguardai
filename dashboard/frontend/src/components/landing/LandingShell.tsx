import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { LogoMark } from '../shared/LogoMark'
import { AmbientEffects } from './components/AmbientEffects'
import { CookieConsent } from './components/CookieConsent'
import { LandingFooter } from './components/LandingFooter'
import { useHashNavigation } from './hooks/useHashNavigation'
import { usePointerSpotlight } from './hooks/usePointerSpotlight'
import { NAV_LINKS, NAV_LINKS_MORE, NAV_LINKS_PRIMARY, type NavLink } from './site'

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

function NavLinkItem({
  link,
  pathname,
  hashHref,
  onHashClick,
  onNavigate,
  className,
}: {
  link: NavLink
  pathname: string
  hashHref: (hash: string) => string
  onHashClick: (event: React.MouseEvent<HTMLAnchorElement>, hash: string) => void
  onNavigate?: () => void
  className?: string
}) {
  if (link.kind === 'route') {
    return (
      <Link
        to={link.to}
        className={className}
        aria-current={pathname === link.to ? 'page' : undefined}
        onClick={onNavigate}
      >
        {link.label}
      </Link>
    )
  }
  return (
    <a
      href={hashHref(link.hash)}
      className={className}
      onClick={(e) => {
        onHashClick(e, link.hash)
        onNavigate?.()
      }}
    >
      {link.label}
    </a>
  )
}

export function LandingShell({ children }: LandingShellProps) {
  const location = useLocation()
  const onHome = location.pathname === '/'
  const moreMenuId = useId()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [navOpen, setNavOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const landingRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  const closeNav = () => setNavOpen(false)
  const { goToHash } = useHashNavigation(closeNav)
  usePointerSpotlight(landingRef)

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
    if (!navOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [navOpen])

  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [moreOpen])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  const openDemo = () => {
    setMoreOpen(false)
    goToHash('#contact')
  }

  const handleHashClick = (event: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    event.preventDefault()
    goToHash(hash)
  }

  const hashHref = (hash: string) => (onHome ? hash : `/${hash}`)

  return (
    <div className="landing" ref={landingRef}>
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg__mesh" />
        <div className="landing-bg__grid" />
      </div>
      <AmbientEffects />

      <header ref={navRef} className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-nav__inner">
          <Link to="/" className="landing-nav__brand" onClick={closeNav}>
            <LogoMark size={32} className="landing-nav__logo" />
            <span className="landing-nav__wordmark">WorkforceGuard AI</span>
          </Link>

          <nav className="landing-nav__links" aria-label="Primary">
            {NAV_LINKS_PRIMARY.map((link) => (
              <NavLinkItem
                key={link.kind === 'route' ? link.to : link.hash}
                link={link}
                pathname={location.pathname}
                hashHref={hashHref}
                onHashClick={handleHashClick}
              />
            ))}

            <div className="landing-nav__more" ref={moreRef}>
              <button
                type="button"
                className="landing-nav__more-btn"
                aria-expanded={moreOpen}
                aria-controls={moreMenuId}
                onClick={() => setMoreOpen((v) => !v)}
              >
                More
                <ChevronDown size={14} className={moreOpen ? 'is-open' : undefined} aria-hidden />
              </button>
              {moreOpen ? (
                <div id={moreMenuId} className="landing-nav__more-menu" role="menu">
                  {NAV_LINKS_MORE.map((link) => (
                    <NavLinkItem
                      key={link.kind === 'route' ? link.to : link.hash}
                      link={link}
                      pathname={location.pathname}
                      hashHref={hashHref}
                      onHashClick={handleHashClick}
                      onNavigate={() => setMoreOpen(false)}
                      className="landing-nav__more-item"
                    />
                  ))}
                </div>
              ) : null}
            </div>
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
              className="landing-cta landing-cta--primary landing-nav__cta landing-nav__cta--demo"
              onClick={openDemo}
            >
              <span className="landing-nav__cta-full">Request a demo</span>
              <span className="landing-nav__cta-short">Demo</span>
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
          {NAV_LINKS.map((link) => (
            <NavLinkItem
              key={link.kind === 'route' ? link.to : link.hash}
              link={link}
              pathname={location.pathname}
              hashHref={hashHref}
              onHashClick={handleHashClick}
              onNavigate={closeNav}
            />
          ))}
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

      <LandingFooter hashHref={hashHref} onHashClick={handleHashClick} />

      <CookieConsent />
    </div>
  )
}
