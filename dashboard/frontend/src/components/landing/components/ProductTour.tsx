import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { PRODUCT_TOUR_TABS } from '../constants'
import { SectionLabel } from './SectionLabel'
import { ScreenshotPanel } from './ScreenshotPanel'

export function ProductTour() {
  const [active, setActive] = useState(0)
  const tab = PRODUCT_TOUR_TABS[active]

  return (
    <section className="landing-section landing-reveal">
      <div id="product-tour" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>Product</SectionLabel>
        <h2>One workspace for intelligence, review, and regulatory evidence</h2>
        <p className="landing-section__lede">
          Six integrated views — explore each module with screenshots from the live dashboard.
        </p>
      </div>

      <div className="landing-product-tour">
        <div className="landing-product-tour__tabs" role="tablist" aria-label="Product modules">
          {PRODUCT_TOUR_TABS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active === i}
              className={`landing-product-tour__tab${active === i ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="landing-product-tour__panel" role="tabpanel">
          <div className="landing-product-tour__copy">
            <h3>{tab.headline}</h3>
            <p>{tab.desc}</p>
            <ul className="landing-product-tour__bullets">
              {tab.bullets.map((b) => (
                <li key={b}>
                  <CheckCircle2 size={16} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <ScreenshotPanel
            src={tab.screenshot}
            alt={tab.headline}
            label={tab.label}
            accentColor={tab.accentColor}
            icon={tab.icon}
          />
        </div>
      </div>
    </section>
  )
}
