import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../../lib/api'
import { resolveAuthErrorMessage } from '../../lib/auth-errors'

type OAuthProvider = 'google' | 'microsoft'

const OAUTH_REDIRECT_STATUSES = new Set([0, 302, 303, 307, 308])

export function LoginScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState<OAuthProvider | null>(null)

  useEffect(() => {
    const authError = searchParams.get('auth_error') ?? searchParams.get('error')
    if (!authError) return

    setMessage(resolveAuthErrorMessage(authError, searchParams.get('error_description')))

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('auth_error')
    nextParams.delete('error')
    nextParams.delete('error_description')
    nextParams.delete('state')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const startOAuth = useCallback(async (provider: OAuthProvider) => {
    setRedirecting(provider)
    setMessage(null)

    const url = `${API_BASE}/auth/login/${provider}`

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 10_000)
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'include',
        signal: controller.signal,
      })
      window.clearTimeout(timeout)

      if (OAUTH_REDIRECT_STATUSES.has(response.status) || response.type === 'opaqueredirect') {
        window.location.assign(url)
        return
      }

      if (!response.ok) {
        setMessage(
          resolveAuthErrorMessage(
            response.status >= 500 ? 'sign_in_unavailable' : 'sign_in_failed',
          ),
        )
        setRedirecting(null)
        return
      }

      window.location.assign(url)
    } catch {
      setMessage(resolveAuthErrorMessage('network_error'))
      setRedirecting(null)
    }
  }, [])

  const dismissMessage = () => setMessage(null)

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <h1 className="login-screen__title">Sign in to WorkforceGuard AI</h1>
        <p className="login-screen__subtitle">
          Use your organisation&apos;s Google or Microsoft account. Access is provisioned per tenant
          after onboarding.
        </p>

        {message && (
          <div className="login-screen__alert" role="alert">
            <p className="login-screen__alert-message">{message}</p>
            <button type="button" className="login-screen__alert-dismiss" onClick={dismissMessage}>
              Dismiss
            </button>
          </div>
        )}

        <div className="login-screen__actions">
          <button
            type="button"
            className="login-button login-button--google"
            disabled={redirecting !== null}
            onClick={() => startOAuth('google')}
          >
            {redirecting === 'google' ? 'Connecting to Google…' : 'Continue with Google'}
          </button>
          <button
            type="button"
            className="login-button login-button--microsoft"
            disabled={redirecting !== null}
            onClick={() => startOAuth('microsoft')}
          >
            {redirecting === 'microsoft' ? 'Connecting to Microsoft…' : 'Continue with Microsoft'}
          </button>
        </div>
        <p className="login-screen__footer">
          Don&apos;t have access yet?{' '}
          <Link to="/">Request a demo</Link> to get your organisation set up.
        </p>
      </div>
    </div>
  )
}