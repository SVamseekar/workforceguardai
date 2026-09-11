export function SandboxBanner() {
  return (
    <div
      role="status"
      style={{
        padding: '10px 16px',
        background: 'var(--tone-watch, #c9a84c)',
        color: '#1a1408',
        fontWeight: 600,
        fontSize: '0.9rem',
        textAlign: 'center',
      }}
    >
      You are viewing a read-only demo with synthetic data — uploads, governance
      actions, and evidence-pack exports are disabled.
    </div>
  )
}
