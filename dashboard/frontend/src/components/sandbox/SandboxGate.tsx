import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { LoginScreen } from '../auth/LoginScreen'

export function SandboxGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (loading) return <div className="auth-loading">Loading…</div>
  if (user?.role === 'sandbox') return <>{children}</>
  if (user) return <LoginScreen />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('sending')
    try {
      const response = await api.post('/sandbox/request-link', { email })
      const consumePath = (response.data as { consume_path?: string | null }).consume_path
      setStatus('sent')
      setMessage(
        consumePath
          ? 'Open the demo link from the API response in local development.'
          : 'If that address is valid, a demo link has been issued.',
      )
      if (consumePath) {
        window.location.assign(consumePath)
      }
    } catch {
      setStatus('error')
      setMessage('Could not send a demo link. Try again in a few minutes.')
    }
  }

  return (
    <main className="auth-loading" style={{ maxWidth: 420, margin: '12vh auto', padding: 24 }}>
      <h1>Try the demo</h1>
      <p>
        Enter your email for a short-lived, read-only session on synthetic Meridian CZ
        data. This is not a live customer tenant.
      </p>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.eu"
          aria-label="Email"
          style={{ width: '100%', marginBottom: 12, padding: 8 }}
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Email me a demo link'}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      <p>
        <Link to="/">Back to WorkforceGuard</Link>
      </p>
    </main>
  )
}
