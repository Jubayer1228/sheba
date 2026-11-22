import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { partnerApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

const SPECIALTIES = [
  { en: 'General Physician', bn: 'জেনারেল ফিজিশিয়ান' },
  { en: 'Dermatology', bn: 'ডার্মাটোলজি' },
  { en: 'Cardiology', bn: 'কার্ডিওলজি' },
  { en: 'Gastroenterology', bn: 'গ্যাস্ট্রোএন্টারোলজি' },
  { en: 'Endocrinology', bn: 'এন্ডোক্রাইনোলজি' },
  { en: 'ENT', bn: 'নাক-কান-গলা' },
]

export function RegisterDoctorPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    nid_number: '',
    specialty: 'General Physician',
    specialty_bn: 'জেনারেল ফিজিশিয়ান',
    bmdc_number: '',
    bio: '',
    is_free_consult: true,
    consult_fee: '299',
    years_exp: '5',
    area: 'Dhanmondi',
    city: 'Dhaka',
    payment_method: 'bkash',
    payment_account: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await partnerApi.registerDoctor({
        ...form,
        is_free_consult: form.is_free_consult,
        consult_fee: form.is_free_consult ? 0 : Number(form.consult_fee) || 299,
        years_exp: Number(form.years_exp) || 5,
      })
      setAuth(data.token, data.user)
      navigate('/doctor', { replace: true })
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
          <h1>Doctor</h1>
          <p>
            Join Sheba as a Bangla-speaking doctor — take free or paid consults from the voice
            agent queue, write prescriptions, and send patients to partner pharmacies.
          </p>
          <ul className="req-list">
            <li>
              <span className="num">1</span> Valid BMDC registration
            </li>
            <li>
              <span className="num">2</span> NID on file
            </li>
            <li>
              <span className="num">3</span> Specialty + consult fee (or free)
            </li>
            <li>
              <span className="num">4</span> bKash / Nagad for paid consults
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
              <label>Specialty</label>
              <select
                value={form.specialty}
                onChange={(e) => {
                  const sp = SPECIALTIES.find((s) => s.en === e.target.value)
                  set('specialty', e.target.value)
                  if (sp) set('specialty_bn', sp.bn)
                }}
              >
                {SPECIALTIES.map((s) => (
                  <option key={s.en} value={s.en}>
                    {s.en}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>BMDC number</label>
              <input value={form.bmdc_number} onChange={(e) => set('bmdc_number', e.target.value)} required />
            </div>
            <div className="field">
              <label>Years of experience</label>
              <input
                type="number"
                min={1}
                value={form.years_exp}
                onChange={(e) => set('years_exp', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Consult type</label>
              <select
                value={form.is_free_consult ? 'free' : 'paid'}
                onChange={(e) => set('is_free_consult', e.target.value === 'free')}
              >
                <option value="free">Free consult</option>
                <option value="paid">Paid consult</option>
              </select>
            </div>
            {!form.is_free_consult ? (
              <div className="field">
                <label>Consult fee (৳)</label>
                <input
                  type="number"
                  min={50}
                  value={form.consult_fee}
                  onChange={(e) => set('consult_fee', e.target.value)}
                />
              </div>
            ) : null}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Bio</label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Bangla / English short intro"
              />
            </div>
            <div className="field">
              <label>Area</label>
              <input value={form.area} onChange={(e) => set('area', e.target.value)} />
            </div>
            <div className="field">
              <label>Payout wallet</label>
              <input
                value={form.payment_account}
                onChange={(e) => set('payment_account', e.target.value)}
                placeholder="bKash number"
              />
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Submitting…' : 'Register as doctor'}
          </button>
        </form>
      </div>
    </main>
  )
}
