import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { appointmentApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

export function AppointmentsPage() {
  const user = useAuthStore((s) => s.user)
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: () => appointmentApi.list(),
    enabled: !!user,
    refetchInterval: 5000,
  })

  if (!user) {
    return (
      <main className="page">
        <p>
          <Link to="/login">Sign in</Link> to see appointments.
        </p>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="doctors-hero">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>{user.role === 'doctor' ? 'Patient visits' : 'My appointments'}</h1>
        </div>
        <Link to="/doctors" className="btn btn-primary">
          Find a doctor
        </Link>
      </header>

      {isLoading ? <p className="muted">Loading…</p> : null}
      {!isLoading && list.length === 0 ? (
        <p className="muted">No appointments yet. Book a video or phone visit.</p>
      ) : null}

      <div className="appt-list">
        {list.map((a) => {
          const other = user.role === 'doctor' ? a.patient : a.doctor
          return (
            <Link key={a.id} to={`/appointments/${a.id}`} className="appt-row">
              <div>
                <strong>{other?.name || 'Visit'}</strong>
                <span>
                  {a.mode} · {format(parseISO(a.scheduled_at), 'd MMM · h:mm a')}
                </span>
              </div>
              <span className="pill">{a.status}</span>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
