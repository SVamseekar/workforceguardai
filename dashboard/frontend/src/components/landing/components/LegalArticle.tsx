import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../../seo/Seo'

type LegalArticleProps = {
  title: string
  description: string
  path: string
  updated: string
  children: ReactNode
}

export function LegalArticle({ title, description, path, updated, children }: LegalArticleProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  return (
    <>
      <Seo title={title} description={description} path={path} />
      <article className="landing-legal">
        <header className="landing-legal__header">
          <p className="landing-section__eyebrow">Legal</p>
          <h1>{title.split(' — ')[0]}</h1>
          <p className="landing-legal__updated">Last updated: {updated}</p>
        </header>
        <div className="landing-legal__prose mission-prose">{children}</div>
        <footer className="landing-legal__footer">
          <Link to="/" className="landing-cta landing-cta--ghost">
            Back to home
          </Link>
        </footer>
      </article>
    </>
  )
}
