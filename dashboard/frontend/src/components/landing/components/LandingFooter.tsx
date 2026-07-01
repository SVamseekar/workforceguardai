import { Link } from 'react-router-dom'
import { LogoMark } from '../../shared/LogoMark'
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_SECTIONS,
  SITE_TAGLINE,
  SUPPORT_EMAIL,
  type FooterLink,
} from '../site'
import { SupportEmailLink } from './SupportEmailLink'

type LandingFooterProps = {
  hashHref: (hash: string) => string
  onHashClick: (event: React.MouseEvent<HTMLAnchorElement>, hash: string) => void
}

function FooterLinkItem({
  link,
  hashHref,
  onHashClick,
}: {
  link: FooterLink
  hashHref: (hash: string) => string
  onHashClick: (event: React.MouseEvent<HTMLAnchorElement>, hash: string) => void
}) {
  switch (link.kind) {
    case 'hash':
      return (
        <a href={hashHref(link.hash)} onClick={(event) => onHashClick(event, link.hash)}>
          {link.label}
        </a>
      )
    case 'route':
      return <Link to={link.to}>{link.label}</Link>
    case 'external':
      return (
        <a href={link.href} target="_blank" rel="noopener noreferrer">
          {link.label}
        </a>
      )
    case 'mailto':
      return (
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(link.subject)}`}>
          {link.label}
        </a>
      )
  }
}

export function LandingFooter({ hashHref, onHashClick }: LandingFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="landing-footer">
      <div className="landing-footer__inner">
        <div className="landing-footer__brand">
          <Link to="/" className="landing-nav__brand">
            <LogoMark size={28} className="landing-nav__logo" />
            <span>WorkforceGuard AI</span>
          </Link>
          <p>{SITE_TAGLINE}</p>
          <p className="landing-footer__email">
            <SupportEmailLink />
          </p>
        </div>

        <div className="landing-footer__cols">
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4>{section.title}</h4>
              <nav aria-label={section.title}>
                {section.links.map((link) => (
                  <FooterLinkItem
                    key={`${section.title}-${link.label}`}
                    link={link}
                    hashHref={hashHref}
                    onHashClick={onHashClick}
                  />
                ))}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="landing-footer__bar">
        <p className="landing-footer__copyright">
          © {year} WorkforceGuard AI. All rights reserved.
        </p>
        <nav className="landing-footer__bar-links" aria-label="Legal">
          {FOOTER_LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
