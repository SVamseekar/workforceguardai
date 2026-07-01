type SectionLabelProps = {
  children: React.ReactNode
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <p className="landing-section__eyebrow">{children}</p>
}
