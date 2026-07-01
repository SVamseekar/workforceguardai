import { MARQUEE_ITEMS } from '../constants'

export function MarqueeStrip() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

  return (
    <div className="landing-marquee landing-reveal" aria-hidden="true">
      <div className="landing-marquee__track">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="landing-marquee__item">{item}</span>
        ))}
      </div>
    </div>
  )
}
