import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone, Video } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { appointmentApi, consultApi, doctorApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import type { Consultation } from '../types'

const DEFAULT_ITEMS = [
  {
    medicine_name: 'Napa',
    generic_name: 'Paracetamol',
    strength: '500mg',
    dosage: '১টি করে দিনে ৩ বার',
    duration: '৩ দিন',
    quantity: 10,
    instructions: 'খাবারের পর',
  },
  {
    medicine_name: 'Fexo',
    generic_name: 'Fexofenadine',
    strength: '120mg',
    dosage: '১টি করে রাতে',
    duration: '৫ দিন',
    quantity: 5,
    instructions: '',
  },
]

export function DoctorDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Consultation | null>(null)
  const [notes, setNotes] = useState('জ্বর ও সর্দির লক্ষণ অনুযায়ী সিম্পটোমেটিক চিকিৎসা।')
  const [error, setError] = useState('')

  const inbox = useQuery({
    queryKey: ['doctor-inbox'],
    queryFn: () => doctorApi.inbox(),
    enabled: user?.role === 'doctor',
    refetchInterval: 8000,
  })

  const incoming = useQuery({
    queryKey: ['doctor-incoming'],
    queryFn: () => doctorApi.incoming(),
    enabled: user?.role === 'doctor',
    refetchInterval: 2000,
  })

  const acceptMut = useMutation({
    mutationFn: (id: number) => consultApi.accept(id),
    onSuccess: (data) => {
      setSelected(data.consultation)
      void qc.invalidateQueries({ queryKey: ['doctor-inbox'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const prescribeMut = useMutation({
    mutationFn: (id: number) =>
      consultApi.prescribe(id, {
        notes,
        items: DEFAULT_ITEMS,
      }),
    onSuccess: (data) => {
      setSelected(data.consultation)
      void qc.invalidateQueries({ queryKey: ['doctor-inbox'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!user) {
    return (
      <main className="page">
        <p>
          Doctor login required. Try <code>doctor@sheba.com.bd</code> / <code>password123</code>
        </p>
        <Link to="/login">Sign in</Link>
      </main>
    )
  }

  if (user.role !== 'doctor') {
    return (
      <main className="page">
        <p>This dashboard is for doctor accounts.</p>
        <Link to="/consult">Patient consult</Link>
      </main>
    )
  }

  const assigned = inbox.data?.assigned ?? []
  const open = inbox.data?.open ?? []
  const profile = inbox.data?.profile
  const ringing = (incoming.data?.calls ?? []).filter((c) => c.status === 'ringing')
  const liveAppts = incoming.data?.appointments ?? []

  return (
    <main className="page doctor-dash">
      <header className="doctor-dash-head">
        <div>
          <p className="eyebrow">Doctor console</p>
          <h1>{user.name}</h1>
          {profile ? (
            <p>
              {profile.specialty_bn} · BMDC {profile.bmdc_number} ·{' '}
              {profile.is_free_consult ? 'Free consults' : `৳${profile.consult_fee}`}
            </p>
          ) : null}
        </div>
        <Link to="/appointments" className="btn btn-secondary">
          Appointments
        </Link>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {ringing.length > 0 ? (
        <div className="incoming-banner" data-testid="doctor-incoming">
          {ringing.map((c) => (
            <div key={c.id} className="incoming-row">
              <div>
                <strong>
                  Incoming {c.mode === 'video' ? <Video size={14} /> : <Phone size={14} />}{' '}
                  {c.mode} call
                </strong>
                <p>{c.patient?.name || 'Patient'} is calling</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="doctor-answer"
                onClick={() => navigate(`/calls/${c.id}`)}
              >
                Answer
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {liveAppts.length > 0 ? (
        <section className="doctor-col" style={{ marginBottom: 16 }}>
          <h2>Live / ready visits</h2>
          {liveAppts.map((a) => (
            <div key={a.id} className="case-row">
              <strong>
                #{a.id} {a.patient?.name} · {a.mode}
              </strong>
              <span>{a.status}</span>
              <button
                type="button"
                className="btn btn-sm"
                data-testid={a.status === 'ringing' ? 'doctor-answer' : 'doctor-join'}
                onClick={async () => {
                  if (a.call_session_id) navigate(`/calls/${a.call_session_id}`)
                  else {
                    const res = await appointmentApi.startCall(a.id)
                    navigate(`/calls/${res.call.id}`)
                  }
                }}
              >
                {a.status === 'ringing' ? 'Answer' : 'Join'}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <div className="doctor-grid">
        <section className="doctor-col">
          <h2>Assigned</h2>
          {assigned.length === 0 ? <p className="muted">No assigned cases</p> : null}
          {assigned.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`case-row${selected?.id === c.id ? ' active' : ''}`}
              onClick={() => setSelected(c)}
            >
              <strong>#{c.id}</strong> {c.patient?.name || 'Patient'} · {c.status}
              <span>{c.summary_bn || c.suggested_specialty}</span>
            </button>
          ))}

          <h2>Open queue</h2>
          {open.length === 0 ? <p className="muted">No open matches</p> : null}
          {open.map((c) => (
            <div key={c.id} className="case-row">
              <strong>#{c.id}</strong> {c.patient?.name} · {c.suggested_specialty}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => acceptMut.mutate(c.id)}
                disabled={acceptMut.isPending}
              >
                Accept
              </button>
            </div>
          ))}
        </section>

        <section className="doctor-col doctor-detail">
          {!selected ? (
            <p className="muted">Select a consultation to review & prescribe.</p>
          ) : (
            <>
              <h2>
                Case #{selected.id}{' '}
                <span className="pill">{selected.status}</span>
              </h2>
              <p>{selected.summary_bn || selected.summary_en}</p>
              <div className="consult-chat compact">
                {(selected.messages ?? []).map((m) => (
                  <div key={m.id} className={`bubble bubble-${m.role}`}>
                    <span className="bubble-role">{m.role}</span>
                    <p>{m.content}</p>
                  </div>
                ))}
              </div>

              {selected.status === 'matched' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => acceptMut.mutate(selected.id)}
                  disabled={acceptMut.isPending}
                >
                  Accept case
                </button>
              ) : null}

              {selected.status === 'in_review' || selected.status === 'matched' ? (
                <div className="rx-writer">
                  <h3>Write prescription</h3>
                  <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <ul className="rx-preview">
                    {DEFAULT_ITEMS.map((it) => (
                      <li key={it.medicine_name}>
                        {it.medicine_name} {it.strength} — {it.dosage}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={prescribeMut.isPending}
                    onClick={() => {
                      if (selected.status === 'matched') {
                        acceptMut.mutate(selected.id, {
                          onSuccess: () => prescribeMut.mutate(selected.id),
                        })
                      } else {
                        prescribeMut.mutate(selected.id)
                      }
                    }}
                  >
                    {prescribeMut.isPending ? 'Saving…' : 'Issue prescription'}
                  </button>
                </div>
              ) : null}

              {selected.status === 'prescribed' || selected.status === 'completed' ? (
                <p className="success-text">
                  Prescription issued. Patient can order from a nearby pharmacy.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
