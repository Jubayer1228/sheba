import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Phone, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { appointmentApi, doctorApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import type { AppointmentMode } from '../types'

export function DoctorBookPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [mode, setMode] = useState<AppointmentMode>('video')
  const [reason, setReason] = useState('জ্বর ও কাশি — পরামর্শ প্রয়োজন')
  const [slotId, setSlotId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const doctorQ = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => doctorApi.get(id!),
    enabled: !!id,
  })
  const slotsQ = useQuery({
    queryKey: ['doctor-slots', id],
    queryFn: () => doctorApi.slots(id!),
    enabled: !!id,
  })

  const profile = doctorQ.data?.profile
  const slots = slotsQ.data ?? []
  const nearSlots = useMemo(
    () => slots.filter((s) => new Date(s.starts_at).getTime() - Date.now() < 2 * 60 * 60 * 1000),
    [slots],
  )

  const bookMut = useMutation({
    mutationFn: appointmentApi.book,
    onSuccess: (appt) => navigate(`/appointments/${appt.id}`),
    onError: (err: Error) => setError(err.message),
  })

  if (!profile) {
    return (
      <main className="page">
        <p className="muted">{doctorQ.isLoading ? 'Loading…' : 'Doctor not found'}</p>
      </main>
    )
  }

  const doctorUserId = profile.user_id

  function requireAuth(action: () => void) {
    if (!user) {
      navigate('/login')
      return
    }
    action()
  }

  return (
    <main className="page book-page">
      <Link to="/doctors" className="linkish">
        ← All doctors
      </Link>
      <header className="book-head">
        <div className="doctor-avatar lg">{(profile.user?.name || 'D').slice(0, 1)}</div>
        <div>
          <h1>{profile.user?.name}</h1>
          <p>
            {profile.specialty_bn} · BMDC {profile.bmdc_number}
          </p>
          <span className={`fee-pill${profile.is_free_consult ? ' free' : ''}`}>
            {profile.is_free_consult ? 'Free' : `৳${profile.consult_fee}`} · {profile.languages}
          </span>
        </div>
      </header>

      <p className="book-bio">{profile.bio}</p>

      <section className="book-panel">
        <h2>Visit type</h2>
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === 'video' ? 'active' : ''}
            onClick={() => setMode('video')}
          >
            <Video size={16} /> Video call
          </button>
          <button
            type="button"
            className={mode === 'phone' ? 'active' : ''}
            onClick={() => setMode('phone')}
          >
            <Phone size={16} /> Phone call
          </button>
        </div>

        <label className="field">
          Reason (Bangla / English)
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        <div className="instant-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={bookMut.isPending}
            onClick={() =>
              requireAuth(() =>
                bookMut.mutate({
                  doctor_id: doctorUserId,
                  mode,
                  reason,
                  reason_bn: reason,
                  instant: true,
                }),
              )
            }
          >
            {mode === 'video' ? 'Start video now' : 'Start phone now'}
          </button>
          <span className="muted">Doctor gets an incoming ring immediately</span>
        </div>

        <h3>Or pick a slot</h3>
        <div className="slot-grid">
          {(nearSlots.length ? nearSlots : slots.slice(0, 12)).map((s) => (
            <button
              key={s.id}
              type="button"
              className={`slot-chip${slotId === s.id ? ' active' : ''}`}
              onClick={() => setSlotId(s.id)}
            >
              {format(parseISO(s.starts_at), 'EEE d MMM · h:mm a')}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!slotId || bookMut.isPending}
          onClick={() =>
            requireAuth(() =>
              bookMut.mutate({
                doctor_id: doctorUserId,
                slot_id: slotId!,
                mode,
                reason,
                reason_bn: reason,
              }),
            )
          }
        >
          Confirm booking
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  )
}
