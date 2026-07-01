import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'

type ScreenshotPanelProps = {
  src: string
  alt: string
  label: string
  accentColor: string
  icon: LucideIcon
}

export function ScreenshotPanel({ src, alt, label, accentColor, icon: Icon }: ScreenshotPanelProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="landing-screenshot landing-screenshot--placeholder">
        <div className="landing-screenshot__placeholder-icon" style={{ color: accentColor }}>
          <Icon size={28} />
        </div>
        <p className="landing-screenshot__placeholder-title">{label}</p>
        <p className="landing-screenshot__placeholder-note">Gallery update in progress</p>
      </div>
    )
  }

  return (
    <div className="landing-screenshot">
      <div className="landing-screenshot__chrome">
        <span className="landing-screenshot__dot" style={{ background: accentColor }} />
        <span className="landing-screenshot__label">{label}</span>
      </div>
      <img
        src={src}
        alt={alt}
        className="landing-screenshot__img"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
