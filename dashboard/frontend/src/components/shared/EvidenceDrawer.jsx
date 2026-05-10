import { X } from 'lucide-react'
import { ProvenanceBadge } from '../primitives/ProvenanceBadge'

export function EvidenceDrawer({ evidence, onClose }) {
  if (!evidence) return null

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
            <h2>{evidence.title}</h2>
          </div>
          <button className="evidence-drawer__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {evidence.summary && (
          <p className="evidence-drawer__summary">{evidence.summary}</p>
        )}

        {evidence.items?.length > 0 && (
          <div className="evidence-drawer__section">
            <h3>Supporting data</h3>
            <ul className="evidence-drawer__list">
              {evidence.items.map((item, i) => (
                <li key={i} className="evidence-drawer__item">
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {evidence.provenance?.length > 0 && (
          <div className="evidence-drawer__section">
            <h3>Sources</h3>
            <ProvenanceBadge provenance={evidence.provenance} />
          </div>
        )}

        {evidence.actions?.length > 0 && (
          <div className="evidence-drawer__actions">
            {evidence.actions.map((action) => (
              <button
                key={action.code}
                className={`governance-button ${action.className ?? ''}`}
                onClick={() => action.onAction(action.code)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
