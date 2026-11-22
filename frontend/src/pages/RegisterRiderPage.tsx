import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { partnerApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

export function RegisterRiderPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    nid_number: '',
    area: 'Dhanmondi',
    city: 'Dhaka',
    vehicle_type: 'motorcycle',
    vehicle_number: '',
    payment_method: 'bkash',
    payment_account: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await partnerApi.registerRider(form)
      setAuth(data.token, data.user)
      navigate('/profile', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page register-form-page">
      <div className="register-form-layout">
        <aside className="register-aside">
          <Link to="/register" className="linkish">
            ← Account types
          </Link>
          <h1>Delivery rider</h1>
          <p>
            Deliver care with pride — flexible hours, live GPS navigation, and payouts to bKash or
            Nagad.
          </p>
          <ul className="req-list">
            <li>
              <span className="num">1</span> Valid NID
            </li>
            <li>
              <span className="num">2</span> Bike / cycle details
            </li>
            <li>
              <span className="num">3</span> Active mobile wallet
            </li>
            <li>
              <span className="num">4</span> Preferred delivery area
            </li>
          </ul>
        </aside>

        <form className="auth-card register-wide" onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Full name</label>
              <input value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} required />
            </div>
            <div className="field">
              <label>NID</label>
              <input value={form.nid_number} onChange={(e) => set('nid_number', e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} required minLength={10} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="field">
              <label>Area</label>
              <input value={form.area} onChange={(e) => set('area', e.target.value)} required />
            </div>
            <div className="field">
              <label>City</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} required />
            </div>
            <div className="field">
              <label>Vehicle</label>
              <select value={form.vehicle_type} onChange={(e) => set('vehicle_type', e.target.value)}>
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="walk">Walking / nearby only</option>
              </select>
            </div>
            <div className="field">
              <label>Vehicle / plate number</label>
              <input
                value={form.vehicle_number}
                onChange={(e) => set('vehicle_number', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Payout method</label>
              <select
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
              </select>
            </div>
            <div className="field">
              <label>Wallet number</label>
              <input
                value={form.payment_account}
                onChange={(e) => set('payment_account', e.target.value)}
                required
              />
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Submitting…' : 'Register as rider'}
          </button>
        </form>
      </div>
    </main>
  )
}
