import { useOverviewData } from '../../hooks/useOverviewData'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { Download, Play } from 'lucide-react'

type AnyObj = Record<string, unknown>

const fullDateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const ACTION_LABELS: Record<string, string> = {
  approved: 'Approved',
  overridden: 'Overridden',
  reversed: 'Reversed',
  exported: 'Exported',
}

export function GovernSection() {
  const {
    overview,
    loading,
    error,
    exporting,
    scheduleLoading,
    exportEvidencePack,
    scheduleBrief,
  } = useOverviewData()

  if (loading) {
    return (
      <div className="dashboard--loading">
        <div className="loading-panel"><h2>Loading…</h2></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard--error">
        <div className="error-panel"><h2>Could not load data</h2><p>{error}</p></div>
      </div>
    )
  }

  if (!overview) return null
  const ov = overview as AnyObj

  const governance = (ov.governance as AnyObj) ?? {}
  const automation = (ov.automation as AnyObj) ?? {}
  const loggedEvents = (governance.logged_events as AnyObj[]) ?? []
  const workflows = (automation.scheduled_workflows as AnyObj[]) ?? []
  const handoffs = (automation.pending_handoffs as AnyObj[]) ?? []

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Govern & Export</p>

      {/* Governance Log */}
      <section className="comparison-section">
        <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
          <p className="panel__eyebrow">Governance Log</p>
          <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Decision history</h2>

          {loggedEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              No decisions logged yet. Approve, override, or reverse pay transparency categories in Pay Analysis to build the log.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Action</th>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Reviewed by</th>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {loggedEvents.map((event, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(159,185,214,0.1)' }}>
                    <td style={{ padding: '12px 0', color: 'var(--text-strong)', fontWeight: 600 }}>
                      {ACTION_LABELS[event.action_code as string] ?? event.action_code as string}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>
                      {(event.target_id as string) ?? (event.target_type as string)}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>
                      {(event.actor as string) ?? 'Dashboard user'}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>
                      {event.recorded_at
                        ? fullDateFormatter.format(new Date(event.recorded_at as string))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Evidence Pack */}
      <section className="comparison-section">
        <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
          <p className="panel__eyebrow">Evidence Pack</p>
          <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Download compliance evidence</h2>

          <div className="product-notes" style={{ marginBottom: 20 }}>
            {[
              'Market metrics with source citations',
              'Benchmark comparisons with methodology notes',
              'Pay transparency review items and decisions',
              'Governance decision log with timestamps',
              'Data vintage and methodology versions',
            ].map((item) => (
              <div key={item} className="product-note">
                <span style={{ color: 'var(--accent-teal)' }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            className="filter-bar__button"
            onClick={exportEvidencePack}
            disabled={exporting}
            style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
          >
            <Download size={16} />
            {exporting ? 'Preparing download…' : 'Download Evidence Pack'}
          </button>
        </div>
      </section>

      {/* Workflow Automation */}
      {(workflows.length > 0 || handoffs.length > 0) && (
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Workflow Automation</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Scheduled workflows</h2>

            {workflows.length > 0 && (
              <div className="phase5-configured" style={{ marginBottom: 20 }}>
                {workflows.map((wf) => (
                  <div key={wf.id as string} className="phase5-handoff">
                    <div>
                      <strong>{wf.label as string}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem', display: 'block', marginTop: 2 }}>
                        {wf.status as string}
                      </span>
                    </div>
                    <button
                      className="governance-button governance-button--approve"
                      onClick={() => scheduleBrief(wf as { id: string; label: string })}
                      disabled={scheduleLoading}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <Play size={14} />
                      Run now
                    </button>
                  </div>
                ))}
              </div>
            )}

            {handoffs.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Pending handoffs</p>
                <div className="phase5-alert-list">
                  {handoffs.map((handoff, i) => (
                    <div key={i} className="phase5-alert">
                      <div className="phase5-alert__top">
                        <div>
                          <h3>{handoff.title as string}</h3>
                          <p>{handoff.description as string}</p>
                        </div>
                        {Boolean(handoff.due_label) && (
                          <span className="comparison-meta__pill">Due: {handoff.due_label as string}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
