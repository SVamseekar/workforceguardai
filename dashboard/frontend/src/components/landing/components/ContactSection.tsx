import { useEffect } from 'react'
import { Mail, MapPin } from 'lucide-react'
import { DemoRequestForm } from '../DemoRequestForm'
import { OPEN_CONTACT_EVENT } from '../site'
import { scrollToSection } from '../utils/scrollToSection'
import { SectionLabel } from './SectionLabel'
import { SupportEmailLink } from './SupportEmailLink'

export function ContactSection() {
  useEffect(() => {
    const onOpen = () => {
      scrollToSection('#contact')
      window.setTimeout(() => {
        document.querySelector<HTMLInputElement>('.demo-form input[autocomplete="given-name"]')?.focus()
      }, 400)
    }
    window.addEventListener(OPEN_CONTACT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, onOpen)
  }, [])

  return (
    <section id="contact" className="landing-section landing-section--alt landing-reveal">
      <div className="landing-contact">
        <div className="landing-contact__intro">
          <SectionLabel>Contact</SectionLabel>
          <h2>Book a walkthrough for your team</h2>
          <p>
            Tell us about your organisation and compliance goals. We reply within one business day at{' '}
            <SupportEmailLink className="landing-contact__email" />.
          </p>
          <div className="landing-contact__meta">
            <span><Mail size={14} /> <SupportEmailLink /></span>
            <span><MapPin size={14} /> EU-focused</span>
          </div>
        </div>
        <DemoRequestForm />
      </div>
    </section>
  )
}
