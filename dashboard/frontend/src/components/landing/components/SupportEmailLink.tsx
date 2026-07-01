import { SUPPORT_EMAIL } from '../site'

type SupportEmailLinkProps = {
  className?: string
  subject?: string
}

export function SupportEmailLink({ className, subject }: SupportEmailLinkProps) {
  const href = subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`
  return (
    <a href={href} className={className}>
      {SUPPORT_EMAIL}
    </a>
  )
}
