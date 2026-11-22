import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Phone, Video } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { appointmentApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

export function AppointmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const apptQ = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentApi.get(id!),
    enabled: !!id,
    refetchInterval: 3000,
  })

  const startMut = useMutation({
    mutationFn: () => appointmentApi.startCall(id!),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['appointment', id] })
      navigate(`/calls/${data.call.id}`)
    },
  })

  const cancelMut = useMutation({
    mutationFn: () => appointmentApi.cancel(id!),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['appointment', id] }),
  })

  const appt = apptQ.data
  if (!appt) {
    return (
      <main className="page">
        <p className="muted">Loading appointment…</p>
      </main>
    )
  }

  const isDoctor = user?.id === appt.doctor_id
  const other = isDoctor ? appt.patient : appt.doctor
  const canCall = ['scheduled', 'ready', 'ringing', 'in_call'].includes(appt.status)

  return (
    <main className="page appt-detail">
      <Link to="/appointments" className="linkish">
        ← My appointments
      </Link>
      <header className="appt-hero">
        <div>
          <p className="eyebrow">
            {appt.mode === 'video' ? <Video size={14} /> : <Phone size={14} />} {appt.mode} ·{' '}
            {appt.is_instant ? 'instant' : 'scheduled'}
          </p>
          <h1>
            {isDoctor ? 'Patient' : 'Doctor'}: {other?.name}
          </h1>
          <p>
            {format(parseISO(appt.scheduled_at), 'EEEE, d MMM yyyy · h:mm a')} ·{' '}
            <span className="pill">{appt.status}</span>
          </p>
        </div>
        <div className={`fee-pill${appt.is_free ? ' free' : ''}`}>
          {appt.is_free ? 'Free' : `৳${appt.fee}`}
        </div>
      </header>

      <section className="book-panel">
        <h2>Reason</h2>
        <p>{appt.reason_bn || appt.reason || '—'}</p>
        {appt.doctor_profile ? (
          <p className="muted">
            {appt.doctor_profile.specialty_bn} · BMDC {appt.doctor_profile.bmdc_number}
          </p>
        ) : null}

        <div className="appt-actions">
          {canCall ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={startMut.isPending}
              onClick={() => startMut.mutate()}
            >
              {appt.status === 'ringing' || appt.status === 'in_call'
                ? 'Join call'
                : appt.mode === 'video'
                  ? 'Start video call'
                  : 'Start phone call'}
            </button>
          ) : null}
          {appt.call_session_id ? (
            <Link className="btn btn-secondary" to={`/calls/${appt.call_session_id}`}>
              Open call room
            </Link>
          ) : null}
          {appt.status === 'scheduled' || appt.status === 'ready' ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Cancel
            </button>
          ) : null}
        </div>
        {startMut.isError ? <p className="error-text">{(startMut.error as Error).message}</p> : null}
      </section>
    </main>
  )
}
