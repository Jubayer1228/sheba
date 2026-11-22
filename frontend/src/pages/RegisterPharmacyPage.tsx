import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { partnerApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

const REQUIREMENTS = [
  'Pharmacy Trade License',
  'Drug License (DGDA approved)',
  'Owner National ID (NID)',
  'Pharmacy name & address',
  'bKash / Nagad / bank account for settlements',
]

export function RegisterPharmacyPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    nid_number: '',
    business_name: '',
    trade_license: '',
    drug_license: '',
    address: '',
    area: 'Dhanmondi',
    city: 'Dhaka',
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
      const data = await partnerApi.registerPharmacy({
        ...form,
        latitude: 23.7461,
        longitude: 90.3742,
      })
      setAuth(data.token, data.user)
      navigate(`/pharmacies/${data.pharmacy.id}`, { replace: true })
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
          <h1>Pharmacy partner</h1>
          <p>
            Join Sheba’s neighborhood network. After registration your shop is listed for nearby
            customers — prescription orders, delivery, and pickup.
          </p>
          <h2>What is required</h2>
          <ul className="req-list">
            {REQUIREMENTS.map((item, i) => (
              <li key={item}>
                <span className="num">{i + 1}</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="aside-note">
            <CheckCircle2 size={18} color="#0f9f8a" />
            Demo mode approves instantly so you can test the full partner flow.
          </div>
        </aside>

        <form className="auth-card register-wide" onSubmit={onSubmit}>
          <h2>Owner & login</h2>
          <div className="form-grid">
            <div className="field">
              <label>Owner name</label>
              <input value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} required />
            </div>
            <div className="field">
              <label>NID number</label>
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
          </div>

          <h2>Pharmacy details</h2>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Pharmacy name</label>
              <input
                value={form.business_name}
                onChange={(e) => set('business_name', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Trade license</label>
              <input
                value={form.trade_license}
                onChange={(e) => set('trade_license', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Drug license (DGDA)</label>
              <input value={form.drug_license} onChange={(e) => set('drug_license', e.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} required />
            </div>
            <div className="field">
              <label>Area</label>
              <input value={form.area} onChange={(e) => set('area', e.target.value)} required />
            </div>
            <div className="field">
              <label>City</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} required />
            </div>
          </div>

          <h2>Settlement</h2>
          <div className="form-grid">
            <div className="field">
              <label>Payment method</label>
              <select
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="bank">Bank account</option>
              </select>
            </div>
            <div className="field">
              <label>Account / wallet number</label>
              <input
                value={form.payment_account}
                onChange={(e) => set('payment_account', e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Submitting…' : 'Register pharmacy'}
          </button>
        </form>
      </div>
    </main>
  )
}
