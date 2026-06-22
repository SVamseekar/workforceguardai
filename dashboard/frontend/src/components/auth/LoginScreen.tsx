const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export function LoginScreen() {
  return (
    <div className="login-screen">
      <h1>Sign in to WorkforceGuard</h1>
      <a className="login-button login-button--google" href={`${API_BASE}/auth/login/google`}>
        Continue with Google
      </a>
      <a className="login-button login-button--microsoft" href={`${API_BASE}/auth/login/microsoft`}>
        Continue with Microsoft
      </a>
    </div>
  )
}