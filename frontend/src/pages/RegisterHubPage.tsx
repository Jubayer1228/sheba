import { Ambulance, Bike, Stethoscope, Store, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

const TYPES = [
  {
    to: '/register/customer',
    title: 'Patient',
    Icon: UserRound,
    tone: 'patient',
  },
  {
    to: '/register/doctor',
    title: 'Doctor',
    Icon: Stethoscope,
    tone: 'doctor',
  },
  {
    to: '/register/pharmacy',
    title: 'Pharmacy',
    Icon: Store,
    tone: 'pharmacy',
  },
  {
    to: '/register/rider',
    title: 'Rider',
    Icon: Bike,
    tone: 'rider',
  },
  {
    to: '/register/ambulance',
    title: 'Ambulance Driver',
    Icon: Ambulance,
    tone: 'ambulance',
  },
] as const

export function RegisterHubPage() {
  return (
    <main className="register-screen">
      <div className="register-screen-inner">
        <header className="register-screen-head">
          <h1>Choose Your Account Type</h1>
          <p>Select a category to register</p>
        </header>

        <div className="account-type-grid">
          {TYPES.map(({ to, title, Icon, tone }) => (
            <Link key={to} to={to} className={`type-tile type-tile--${tone}`}>
              <div className="type-tile-art" aria-hidden>
                <span className="type-tile-blob" />
                <Icon strokeWidth={1.75} />
              </div>
              <span className="type-tile-label">{title}</span>
            </Link>
          ))}
        </div>

        <p className="register-screen-foot">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
