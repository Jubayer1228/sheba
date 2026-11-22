import { useQuery } from '@tanstack/react-query'
import { Phone, Video, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { doctorApi } from '../api/endpoints'

export function DoctorsPage() {
  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorApi.list(),
  })

  return (
    <main className="page doctors-page">
      <header className="doctors-hero">
        <div>
          <p className="eyebrow">Sheba Telehealth</p>
          <h1>ডাক্তারের সাথে কথা বলুন</h1>
          <p>
            Book a free or paid Bangla consult — video, phone, or chat. Instant join available for
            demo slots.
          </p>
        </div>
        <Link to="/consult" className="btn btn-secondary">
          বাংলা ভয়েস এজেন্ট
        </Link>
      </header>

      {isLoading ? <p className="muted">Loading doctors…</p> : null}

      <div className="doctor-cards">
        {doctors.map((d) => (
          <article key={d.id} className="doctor-card">
            <div className="doctor-card-top">
              <div className="doctor-avatar" aria-hidden>
                {(d.user?.name || 'Dr').slice(0, 1)}
              </div>
              <div>
                <h2>{d.user?.name || `Doctor #${d.user_id}`}</h2>
                <p>
                  {d.specialty_bn} · {d.years_exp} yrs
                </p>
                <span className={`fee-pill${d.is_free_consult ? ' free' : ''}`}>
                  {d.is_free_consult ? 'Free consult' : `৳${d.consult_fee}`}
                </span>
              </div>
            </div>
            <p className="doctor-bio">{d.bio}</p>
            <div className="doctor-meta">
              <span>
                <BadgeCheck size={14} /> BMDC {d.bmdc_number}
              </span>
              <span>★ {d.rating.toFixed(1)}</span>
              <span>{d.languages}</span>
            </div>
            <div className="doctor-actions">
              <Link to={`/doctors/${d.user_id}`} className="btn btn-primary">
                Book / Call
              </Link>
              <span className="mode-hints">
                <Video size={14} /> <Phone size={14} />
              </span>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
