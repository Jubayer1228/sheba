import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const from = (location.state as { from?: string } | null)?.from || '/'

  const [email, setEmail] = useState('demo@sheba.com.bd')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login({ email, password })
      setAuth(data.token, data.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-narrow">
      <div className="auth-card">
        <Link to="/" className="brand" style={{ marginBottom: 18 }}>
          <span className="brand-mark">✚</span>
          <span>
            Sheba<em>.</em>
          </span>
        </Link>
        <h1>Welcome back</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Sign in to order from neighborhood pharmacies and manage prescriptions.
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 18, fontSize: '0.9rem' }}>
          New here?{' '}
          <Link to="/register" className="linkish">
            Choose account type
          </Link>
        </p>
        <p className="muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
          Demo: demo@sheba.com.bd / password123
        </p>
      </div>
    </main>
  )
}
