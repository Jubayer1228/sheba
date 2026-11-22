import { Mic, MicOff, Send, Stethoscope } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { consultApi, pharmacyApi, prescriptionApi, voiceApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import { useLocationStore } from '../stores/locationStore'
import type { Consultation, Prescription } from '../types'

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function ConsultPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const location = useLocationStore()
  const [consult, setConsult] = useState<Consultation | null>(null)
  const [rx, setRx] = useState<Prescription | null>(null)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [preferPaid, setPreferPaid] = useState<'free' | 'paid' | 'any'>('any')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pharmacyId, setPharmacyId] = useState<number | null>(null)
  const [ordering, setOrdering] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        setBusy(true)
        const existing = await consultApi.list()
        const open = existing.find((c) =>
          ['active', 'matched', 'in_review', 'prescribed'].includes(c.status),
        )
        if (open) {
          const full = await consultApi.get(open.id)
          if (!cancelled) {
            setConsult(full.consultation)
            if (full.prescription) setRx(full.prescription)
          }
        } else {
          const started = await consultApi.start()
          if (!cancelled) setConsult(started.consultation)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
      recRef.current?.stop()
    }
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consult?.messages?.length])

  useEffect(() => {
    if (!rx || pharmacyId) return
    pharmacyApi
      .list({ lat: location.lat, lng: location.lng, sort: 'distance', rx: true })
      .then((list) => {
        if (list[0]) setPharmacyId(list[0].id)
      })
      .catch(() => undefined)
  }, [rx, pharmacyId, location.lat, location.lng])

  async function sendMessage(content: string, isVoice = false) {
    if (!consult || !content.trim()) return
    setError('')
    setBusy(true)
    try {
      const res = await consultApi.message(consult.id, {
        content: content.trim(),
        lang: 'en',
        is_voice: isVoice,
      })
      setConsult(res.consultation)
      if (res.prescription) setRx(res.prescription)
      setText('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleVoice() {
    // Prefer Deepgram via /voice/turn; fall back to Web Speech API
    if (listening && mediaRecRef.current) {
      mediaRecRef.current.stop()
      return
    }
    if (listening && recRef.current) {
      recRef.current.stop()
      setListening(false)
      return
    }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setListening(false)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        void (async () => {
          if (!consult) return
          setBusy(true)
          try {
            const form = new FormData()
            form.append('audio', blob, 'utterance.webm')
            form.append('consultation_id', String(consult.id))
            form.append('lang', 'en')
            const data = await voiceApi.turn(form)
            setConsult(data.consultation)
            if (data.audio_b64) {
              const audio = new Audio(
                `data:${data.audio_mime || 'audio/mpeg'};base64,${data.audio_b64}`,
              )
              void audio.play()
            }
          } catch (err) {
            // fallback: browser speech recognition
            const Ctor = getSpeechRecognition()
            if (!Ctor) {
              setError((err as Error).message)
              return
            }
            setError('Deepgram turn failed — try browser speech or type.')
          } finally {
            setBusy(false)
          }
        })()
      }
      mediaRecRef.current = rec
      rec.start()
      setListening(true)
    } catch {
      const Ctor = getSpeechRecognition()
      if (!Ctor) {
        setError('Microphone or voice support unavailable — please type.')
        return
      }
      const rec = new Ctor()
      rec.lang = 'en-US'
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = (ev) => {
        const said = ev.results[0]?.[0]?.transcript || ''
        if (said) void sendMessage(said, true)
      }
      rec.onerror = () => {
        setListening(false)
        setError('Could not hear you — try again or type.')
      }
      rec.onend = () => setListening(false)
      recRef.current = rec
      setListening(true)
      rec.start()
    }
  }

  async function matchDoctor() {
    if (!consult) return
    setBusy(true)
    setError('')
    try {
      const body: { prefer_paid?: boolean } = {}
      if (preferPaid === 'free') body.prefer_paid = false
      if (preferPaid === 'paid') body.prefer_paid = true
      const res = await consultApi.match(consult.id, body)
      setConsult(res.consultation)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function orderRx() {
    if (!rx || !pharmacyId) return
    setOrdering(true)
    setError('')
    try {
      const data = await prescriptionApi.orderFromRx(rx.id, {
        pharmacy_id: pharmacyId,
        type: 'delivery',
        payment_method: 'cod',
        delivery_address: location.label || 'House 12, Road 4, Dhanmondi',
        delivery_area: location.area || 'Dhanmondi',
        delivery_city: location.city || 'Dhaka',
        delivery_lat: location.lat,
        delivery_lng: location.lng,
      })
      navigate(`/orders/${data.order.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOrdering(false)
    }
  }

  if (!user) {
    return (
      <main className="page">
        <div className="consult-shell">
          <h1>Health chat</h1>
          <p>Sign in to talk with the live chat agent and match a doctor.</p>
          <Link className="btn btn-primary" to="/login">
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const messages = consult?.messages ?? []
  const canMatch = consult?.status === 'active'
  const prescribed = consult?.status === 'prescribed' || consult?.status === 'completed'

  return (
    <main className="page consult-page">
      <div className="consult-shell">
        <header className="consult-head">
          <div>
            <p className="eyebrow">Sheba Care · LLM + Deepgram</p>
            <h1>Live health chat</h1>
            <p>Describe symptoms in English (voice or text) → free/paid doctor match → prescription → pharmacy order</p>
            <p className="match-actions" style={{ marginTop: 10 }}>
              <Link className="btn btn-primary" to="/voice">
                Start Deepgram voice call
              </Link>
            </p>
          </div>
          <Stethoscope className="consult-icon" size={36} />
        </header>

        <div className="consult-chat" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`bubble bubble-${m.role}`}>
              <span className="bubble-role">
                {m.role === 'agent' ? 'Agent' : m.role === 'doctor' ? 'Doctor' : 'You'}
                {m.is_voice ? ' · voice' : ''}
              </span>
              <p>{m.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {consult?.doctor_profile ? (
          <div className="match-card">
            <strong>{consult.doctor?.name || consult.doctor_profile.user?.name}</strong>
            <span>
              {consult.doctor_profile.specialty_bn} ·{' '}
              {consult.doctor_profile.is_free_consult
                ? 'ফ্রি'
                : `৳${consult.doctor_profile.consult_fee}`}
            </span>
            <p>{consult.match_reason}</p>
            {consult.doctor_id ? (
              <div className="match-actions">
                <Link className="btn btn-primary" to={`/doctors/${consult.doctor_id}`}>
                  Schedule video / phone
                </Link>
                <Link className="btn btn-secondary" to="/appointments">
                  My appointments
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {prescribed && rx ? (
          <div className="rx-order-card">
            <h3>Prescription ready</h3>
            <ul>
              {(rx.items ?? []).map((it) => (
                <li key={it.id}>
                  {it.medicine_name} {it.strength} — {it.dosage} ({it.quantity}x)
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              disabled={ordering || !pharmacyId}
              onClick={() => void orderRx()}
            >
              {ordering ? 'Ordering…' : 'Order from nearby pharmacy'}
            </button>
          </div>
        ) : null}

        {canMatch ? (
          <div className="match-controls">
            <label>
              Doctor preference
              <select
                value={preferPaid}
                onChange={(e) => setPreferPaid(e.target.value as typeof preferPaid)}
              >
                <option value="any">Any</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void matchDoctor()}>
              Match a doctor
            </button>
          </div>
        ) : null}

        {consult && ['active', 'matched', 'in_review'].includes(consult.status) ? (
          <form
            className="consult-composer"
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(text, false)
            }}
          >
            <button
              type="button"
              className={`icon-btn voice-btn${listening ? ' listening' : ''}`}
              onClick={toggleVoice}
              aria-label="Voice input"
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type in English or tap the mic…"
              disabled={busy}
              data-testid="consult-text"
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
              <Send size={16} />
            </button>
          </form>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        {busy && !consult ? <p className="muted">Starting…</p> : null}
      </div>
    </main>
  )
}
