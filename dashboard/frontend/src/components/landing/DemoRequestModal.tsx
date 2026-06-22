import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { DemoRequestForm } from './DemoRequestForm'

type DemoRequestModalProps = {
  open: boolean
  onClose: () => void
}

export function DemoRequestModal({ open, onClose }: DemoRequestModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="demo-modal" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="demo-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="demo-modal__header">
          <div>
            <p className="demo-modal__eyebrow">Request a demo</p>
            <h2 id="demo-modal-title">See WorkforceGuard tailored to your organisation</h2>
          </div>
          <button
            type="button"
            className="demo-modal__close"
            onClick={onClose}
            aria-label="Close demo request form"
          >
            <X size={20} />
          </button>
        </header>
        <div className="demo-modal__body">
          <DemoRequestForm />
        </div>
      </div>
    </div>
  )
}