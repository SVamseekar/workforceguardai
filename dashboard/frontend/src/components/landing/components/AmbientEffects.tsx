/**
 * Fixed atmospheric layer: drifting orbs, subtle grain, and a pointer spotlight.
 * Purely decorative — hidden from AT and disabled under reduced-motion.
 */
export function AmbientEffects() {
  return (
    <div className="landing-ambient" aria-hidden="true">
      <div className="landing-ambient__orb landing-ambient__orb--a" />
      <div className="landing-ambient__orb landing-ambient__orb--b" />
      <div className="landing-ambient__orb landing-ambient__orb--c" />
      <div className="landing-ambient__spotlight" />
      <div className="landing-ambient__grain" />
      <div className="landing-ambient__beam" />
    </div>
  )
}
