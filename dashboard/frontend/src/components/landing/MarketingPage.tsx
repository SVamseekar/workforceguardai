import type { ReactNode } from 'react'
import { Seo } from '../seo/Seo'
import {
  buildOrganizationSchema,
  buildWebPageSchema,
  buildWebSiteSchema,
} from '../../lib/seo'
import { useScrollReveal } from './useScrollReveal'
import './landing.css'

type MarketingPageProps = {
  title: string
  description: string
  path: string
  eyebrow?: ReactNode
  heading: ReactNode
  lede?: ReactNode
  jsonLd?: Record<string, unknown>[]
  children?: ReactNode
}

export function MarketingPage({
  title,
  description,
  path,
  eyebrow,
  heading,
  lede,
  jsonLd,
  children,
}: MarketingPageProps) {
  useScrollReveal()
  return (
    <>
      <Seo
        title={title}
        description={description}
        path={path}
        jsonLd={
          jsonLd ?? [
            buildOrganizationSchema(),
            buildWebSiteSchema(),
            buildWebPageSchema({ title, description, path }),
          ]
        }
      />
      <section className="mission-hero landing-reveal">
        <div className="mission-hero__inner">
          {eyebrow ? <p className="mission-hero__eyebrow">{eyebrow}</p> : null}
          <h1>{heading}</h1>
          {lede ? <p className="mission-hero__lede">{lede}</p> : null}
        </div>
      </section>
      {children}
    </>
  )
}
