import { useId } from 'react'

interface LogoMarkProps {
  size?: number
  className?: string
  title?: string
}

export function LogoMark({ size = 28, className, title = 'WorkforceGuard AI' }: LogoMarkProps) {
  const uid = useId().replace(/:/g, '')
  const shieldGrad = `wg-shield-${uid}`
  const shineGrad = `wg-shine-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={shieldGrad} x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-primary, #3b82f6)" />
          <stop offset="1" stopColor="var(--accent-teal, #14b8a6)" />
        </linearGradient>
        <linearGradient id={shineGrad} x1="16" y1="6" x2="16" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d="M16 2.75c4.2 2.1 8.45 3.15 10.75 3.85v8.35c0 5.55-4.35 9.85-10.75 12.55C9.6 24.3 5.25 20 5.25 14.95V6.6C7.55 5.9 11.8 4.85 16 2.75Z"
        fill={`url(#${shieldGrad})`}
      />
      <path
        d="M16 2.75c4.2 2.1 8.45 3.15 10.75 3.85v8.35c0 5.55-4.35 9.85-10.75 12.55C9.6 24.3 5.25 20 5.25 14.95V6.6C7.55 5.9 11.8 4.85 16 2.75Z"
        fill={`url(#${shineGrad})`}
      />

      <path
        d="M16 6.2 21.4 8.1v5.45c0 3.35-2.45 5.95-5.4 7.45-2.95-1.5-5.4-4.1-5.4-7.45V8.1L16 6.2Z"
        fill="var(--bg-deep, #080d16)"
        fillOpacity="0.22"
      />

      <rect x="10.2" y="17.1" width="2.4" height="4.8" rx="0.55" fill="#fff" fillOpacity="0.92" />
      <rect x="13.5" y="14.7" width="2.4" height="7.2" rx="0.55" fill="#fff" fillOpacity="0.92" />
      <rect x="16.8" y="12.3" width="2.4" height="9.6" rx="0.55" fill="#fff" fillOpacity="0.92" />
      <rect x="20.1" y="15.5" width="2.4" height="6.4" rx="0.55" fill="#fff" fillOpacity="0.72" />

      <path
        d="M9.8 18.8 13.1 15.8 16.2 14.1 19.4 12.2 22.2 10.6"
        stroke="#fff"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.2" cy="10.6" r="1.35" fill="#fff" />
      <circle cx="22.2" cy="10.6" r="2.2" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" />

      <circle cx="16" cy="8.4" r="1.05" fill="var(--landing-gold, #c9a84c)" />
    </svg>
  )
}