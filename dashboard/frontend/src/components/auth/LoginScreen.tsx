import { Link } from 'react-router-dom'
import { API_BASE } from '../../lib/api'

export function LoginScreen() {
  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <h1 className="login-screen__title">Sign in to WorkforceGuard AI</h1>
        <p className="login-screen__subtitle">
          Use your organisation&apos;s Google or Microsoft account. Access is provisioned per tenant
          after onboarding.
        </p>
        <div className="login-screen__actions">
          <a className="login-button login-button--google" href={`${API_BASE}/auth/login/google`}>
            Continue with Google
          </a>
          <a className="login-button login-button--microsoft" href={`${API_BASE}/auth/login/microsoft`}>
            Continue with Microsoft
          </a>
        </div>
        <p className="login-screen__footer">
          Don&apos;t have access yet?{' '}
          <Link to="/">Request a demo</Link> to get your organisation set up.
        </p>
      </div>
    </div>
  )
}