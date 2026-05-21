import { useOverviewData } from '../../hooks/useOverviewData'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { Download, Play, CheckCircle, XCircle } from 'lucide-react'
import { DataState } from '../shared/DataState'

type AnyObj = Record<string, unknown>

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  daily: 'Daily',
}

const AUDIENCE_LABELS: Record<string, string> = {
  executive_leadership: 'Executive leadership',
  people_analytics_compliance: 'People analytics & compliance',
  legal_compliance_review: 'Legal & compliance review',
}

function formatDate(val: unknown): string {
  if (!val) return '—'
  try { return dateFormatter.format(new Date(val as string)) }
  catch { return '—' }
}

export function GovernSection() {
  const { overview, loading, error, exporting, scheduleLoading, exportEvidencePack, scheduleBrief } = useOverviewData()

  const ov = (overview ?? {}) as AnyObj
  const governance = (ov.governance as AnyObj) ?? {}
  const automation = (ov.automation as AnyObj) ?? {}
  const integrity = (governance.integrity as AnyObj) ?? {}
  const loggedEvents = ((governance.logged_events ?? governance.events) as AnyObj[]) ?? []
  const workflows = (automation.scheduled_workflows as AnyObj[]) ?? []
  const scheduledBriefs = (automation.scheduled_briefs as AnyObj[]) ?? []
  const configuredSchedules = (automation.configured_schedules as AnyObj[]) ?? []
  const handoffs = (automation.pending_handoffs as AnyObj[]) ?? []

  // workflows is referenced above but unused below — keep for future use
  void workflows

  const eventCount = (integrity.event_count as number) ?? loggedEvents.length
  const chainVerified = integrity.verified !== false
  const latestHash = (integrity.latest_hash as string | undefined)?.slice(0, 8) ?? null

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
        <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Govern & Export</p>

        {/* ── Chain Integrity Status ── */}
        <div className="chain-integrity" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {chainVerified
              ? <CheckCircle size={14} style={{ color: 'var(--tone-good)', flexShrink: 0 }} />
              : <XCircle size={14} style={{ color: 'var(--tone-watch)', flexShrink: 0 }} />
            }
            <span className="chain-integrity__status">
              {chainVerified ? 'Chain intact' : 'Chain break detected'}
            </span>
            <span className="chain-integrity__sep">·</span>
            <span className="chain-integrity__count">{eventCount} {eventCount === 1 ? 'event' : 'events'}</span>
            {latestHash && (
              <>
                <span className="chain-integrity__sep">·</span>
                <span className="chain-integrity__hash">SHA-256: {latestHash}…</span>
              </>
            )}
          </div>
        </div>

        {/* ── Governance Log ── */}
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Governance Log</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Decision history</h2>

            {loggedEvents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  No decisions logged yet. The governance log is a tamper-evident, hash-chained record of every pay transparency decision made in this workspace.
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  To create entries: go to <strong style={{ color: 'var(--text-strong)' }}>Pay Analysis</strong>, select a country, then approve, override, or reverse pay transparency categories using the action buttons.
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  All decisions are included in the evidence pack and are legally defensible under Article 9 of the EU Pay Transparency Directive.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0 12px 10px 0', fontWeight: 700 }}>Action</th>
                    <th style={{ padding: '0 12px 10px 0', fontWeight: 700 }}>Category</th>
                    <th style={{ padding: '0 12px 10px 0', fontWeight: 700 }}>Reviewed by</th>
                    <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loggedEvents.map((event, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(159,185,214,0.1)' }}>
                      <td style={{ padding: '11px 12px 11px 0', color: 'var(--text-strong)', fontWeight: 600 }}>
                        {(event.action_label as string) ?? (event.action_name as string) ?? (event.action_code as string)}
                      </td>
                      <td style={{ padding: '11px 12px 11px 0', color: 'var(--text-muted)' }}>
                        {(event.target_label as string) ?? (event.target_id as string) ?? (event.target_type as string)}
                      </td>
                      <td style={{ padding: '11px 12px 11px 0', color: 'var(--text-muted)' }}>
                        {(event.actor as string) ?? 'Dashboard user'}
                      </td>
                      <td style={{ padding: '11px 0', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(event.recorded_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Evidence Pack ── */}
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Evidence Pack</p>
            <h2 style={{ margin: '6px 0 4px', fontSize: '1.15rem' }}>Download compliance evidence</h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              A cryptographically hash-chained JSON bundle containing all market data, pay simulation states, and {eventCount} governance {eventCount === 1 ? 'decision' : 'decisions'} — ready for legal or regulatory review.
            </p>

            <div className="product-notes" style={{ marginBottom: 20 }}>
              {[
                'Market metrics with source citations (Eurostat LFS, JVS)',
                'Benchmark comparisons with methodology notes',
                'Pay transparency review items and decisions',
                `Governance decision log with timestamps (${eventCount} events, SHA-256 hash-chained)`,
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

        {/* ── Workflow Automation — always visible ── */}
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Workflow Automation</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Scheduled workflows</h2>

            {configuredSchedules.length > 0 ? (
              <div className="phase5-configured" style={{ marginBottom: 24 }}>
                {configuredSchedules.map((wf) => (
                  <div key={(wf.schedule_id as string) ?? (wf.id as string)} className="phase5-handoff">
                    <div>
                      <strong>{wf.label as string}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'block', marginTop: 3 }}>
                        {CADENCE_LABELS[wf.cadence as string] ?? (wf.cadence as string)} · {wf.approval_required ? 'Requires approval' : 'Auto-runs'} · Status: {wf.status as string}
                      </span>
                    </div>
                    <button
                      className="governance-button governance-button--approve"
                      onClick={() => scheduleBrief(wf as { id: string; label: string })}
                      disabled={scheduleLoading}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <Play size={14} /> Run now
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                No active schedules. Configure one of the templates below to automatically generate briefs or compliance packs on a recurring cadence.
              </p>
            )}

            {scheduledBriefs.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Available templates</p>
                <div className="phase5-configured">
                  {scheduledBriefs.map((brief) => (
                    <div key={brief.id as string} className="phase5-handoff">
                      <div>
                        <strong>{brief.label as string}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'block', marginTop: 3 }}>
                          {CADENCE_LABELS[brief.cadence as string] ?? brief.cadence as string} · {brief.approval_required ? 'Requires approval' : 'Auto-runs'}
                        </span>
                      </div>
                      <button
                        className="governance-button governance-button--approve"
                        onClick={() => scheduleBrief(brief as { id: string; label: string })}
                        disabled={scheduleLoading}
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      >
                        <Play size={14} /> Schedule
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {handoffs.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12, marginTop: 24 }}>Actions required</p>
                <div className="phase5-alert-list">
                  {handoffs.map((handoff) => (
                    <div key={handoff.id as string} className="phase5-alert">
                      <div className="phase5-alert__top">
                        <div>
                          <h3>{handoff.title as string}</h3>
                          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {AUDIENCE_LABELS[handoff.target_audience as string] ?? (handoff.target_audience as string)}
                          </p>
                        </div>
                        <span className="comparison-meta__pill" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {(() => { const s = handoff.status as string; return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending' })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

      </DataState>
    </div>
  )
}
