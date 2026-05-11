import { X } from 'lucide-react'
import { ProvenanceBadge } from '../primitives/ProvenanceBadge'

type AnyObj = Record<string, unknown>

export function EvidenceDrawer({ evidence, onClose }: { evidence: unknown; onClose: () => void }) {
  if (!evidence) return null
  const ev = evidence as AnyObj

  return (
    <>
      <button
        className="evidence-drawer__backdrop"
        aria-label="Close evidence panel"
        onClick={onClose}
      />
      <aside className="evidence-drawer">
        <div className="evidence-drawer__header">
          <div>
            <p className="panel__eyebrow">Evidence</p>
            <h2>{ev.title as string}</h2>
          </div>
          <button className="evidence-drawer__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {Boolean(ev.summary) && (
          <p className="evidence-drawer__summary">{ev.summary as string}</p>
        )}

        {((ev.items as AnyObj[])?.length ?? 0) > 0 && (
          <div className="evidence-drawer__section">
            <h3>Supporting data</h3>
            <ul className="evidence-drawer__list">
              {(ev.items as AnyObj[]).map((item, i) => (
                <li key={i} className="evidence-drawer__item">
                  <strong>{item.label as string}</strong>
                  <span>{item.value as string}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {((ev.provenance as AnyObj[])?.length ?? 0) > 0 && (
          <div className="evidence-drawer__section">
            <h3>Sources</h3>
            <ProvenanceBadge provenance={ev.provenance as Array<{ source_id: string }>} />
          </div>
        )}

        {((ev.actions as AnyObj[])?.length ?? 0) > 0 && (
          <div className="evidence-drawer__actions">
            {(ev.actions as AnyObj[]).map((action) => (
              <button
                key={action.code as string}
                className={`governance-button ${(action.className as string) ?? ''}`}
                onClick={() => (action.onAction as (code: string) => void)(action.code as string)}
              >
                {action.label as string}
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
