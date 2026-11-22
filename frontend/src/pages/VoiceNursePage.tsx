import { Mic, PhoneOff, Send, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrap } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import type { Consultation } from '../types'

type TurnResponse = {
  consultation: Consultation
  transcript: string
  reply_bn: string
  reply_en: string
  specialty: string
  ready: boolean
  source: string
  audio_b64?: string
  audio_mime?: string
}

async function voiceTurn(form: FormData) {
  const res = await api.post<{ data: TurnResponse }>('/voice/turn', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return unwrap(res)
}

async function voiceTurnText(payload: {
  text: string
  consultation_id?: number
  lang?: string
}) {
  const res = await api.post<{ data: TurnResponse }>('/voice/turn', payload)
  return unwrap(res)
}

function playB64(b64: string, mime = 'audio/mpeg') {
  const audio = new Audio(`data:${mime};base64,${b64}`)
  void audio.play()
  return audio
}

export function VoiceNursePage() {
  const user = useAuthStore((s) => s.user)
  const [consult, setConsult] = useState<Consultation | null>(null)
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const [error, setError] = useState('')
  const [lastReplyEn, setLastReplyEn] = useState('')
  const [text, setText] = useState('')
  const [aiStatus, setAiStatus] = useState<{ llm?: boolean; deepgram?: boolean; model?: string }>({})
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!user) return
    api
      .get<{ data: { llm: boolean; deepgram: boolean; model: string } }>('/voice/status')
      .then((r) => setAiStatus(unwrap(r)))
      .catch(() => undefined)
  }, [user])

  async function applyTurn(data: TurnResponse) {
    setConsult(data.consultation)
    setLastReplyEn(data.reply_en || data.reply_bn)
    if (data.audio_b64) {
      setStatus('speaking')
      audioRef.current?.pause()
      const a = playB64(data.audio_b64, data.audio_mime || 'audio/mpeg')
      audioRef.current = a
      a.onended = () => setStatus('idle')
    } else {
      setStatus('idle')
    }
  }

  async function sendAudio(blob: Blob) {
    setStatus('thinking')
    setError('')
    try {
      const form = new FormData()
      form.append('audio', blob, 'turn.webm')
      form.append('lang', 'en')
      if (consult?.id) form.append('consultation_id', String(consult.id))
      const data = await voiceTurn(form)
      await applyTurn(data)
    } catch (err) {
      setError((err as Error).message)
      setStatus('idle')
    }
  }

  async function sendText() {
    if (!text.trim() || status === 'thinking' || status === 'speaking') return
    setStatus('thinking')
    setError('')
    try {
      const data = await voiceTurnText({
        text: text.trim(),
        consultation_id: consult?.id,
        lang: 'en',
      })
      setText('')
      await applyTurn(data)
    } catch (err) {
      setError((err as Error).message)
      setStatus('idle')
    }
  }

  async function toggleListen() {
    if (status === 'listening' && mediaRef.current) {
      mediaRef.current.stop()
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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        void sendAudio(blob)
      }
      mediaRef.current = rec
      rec.start()
      setStatus('listening')
    } catch (err) {
      setError((err as Error).message || 'Microphone permission required')
    }
  }

  if (!user) {
    return (
      <main className="page">
        <p>
          <Link to="/login">Sign in</Link> for the English voice nurse.
        </p>
      </main>
    )
  }

  const messages = consult?.messages ?? []

  return (
    <main className="call-room voice-nurse" data-testid="voice-nurse">
      <header className="call-room-head">
        <div>
          <p className="eyebrow">AI VOICE CALL</p>
          <h1>Sheba Voice Nurse</h1>
          <p>
            Deepgram ASR (en) → LLM ({aiStatus.model || 'Ornith'}) → Deepgram TTS ·{' '}
            {aiStatus.deepgram ? 'DG✓' : 'DG✗'} {aiStatus.llm ? 'LLM✓' : 'LLM✗'}
          </p>
        </div>
        <Link to="/consult" className="btn btn-secondary">
          Text chat
        </Link>
      </header>

      <div className="phone-stage">
        <div className={`phone-avatar${status === 'listening' ? ' pulse' : ''}`}>S</div>
        <p>
          {status === 'idle' && 'Tap mic or type symptoms in English'}
          {status === 'listening' && 'Listening… tap again to send'}
          {status === 'thinking' && 'Transcribing + thinking (LLM can take a few minutes)…'}
          {status === 'speaking' && 'Agent speaking (Deepgram TTS)…'}
        </p>
        {lastReplyEn ? <p className="muted-on-dark">{lastReplyEn}</p> : null}
      </div>

      <div className="consult-chat compact voice-transcript">
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>
            <span className="bubble-role">
              {m.role === 'agent' ? 'Nurse' : 'You'}
              {m.is_voice ? ' · voice' : ''}
            </span>
            <p>{m.content}</p>
          </div>
        ))}
      </div>

      <form
        className="consult-composer voice-text"
        onSubmit={(e) => {
          e.preventDefault()
          void sendText()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type in English…"
          disabled={status === 'thinking' || status === 'speaking'}
          data-testid="voice-text"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={status === 'thinking' || status === 'speaking' || !text.trim()}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>

      <div className="call-controls">
        <button
          type="button"
          className={`ctrl-btn${status === 'listening' ? ' live' : ''}`}
          onClick={() => void toggleListen()}
          disabled={status === 'thinking' || status === 'speaking'}
          aria-label="Hold to talk"
          data-testid="voice-mic"
        >
          <Mic />
        </button>
        <button
          type="button"
          className="ctrl-btn"
          disabled={!lastReplyEn}
          onClick={() => {
            if (!lastReplyEn) return
            void api
              .post<{ data: { audio_b64: string; mime: string } }>('/voice/speak', {
                text: lastReplyEn,
              })
              .then((r) => {
                const d = unwrap(r)
                playB64(d.audio_b64, d.mime)
              })
          }}
          aria-label="Replay"
        >
          <Volume2 />
        </button>
        <Link to="/doctors" className="ctrl-btn hangup" aria-label="End">
          <PhoneOff />
        </Link>
      </div>

      {consult?.suggested_specialty ? (
        <p className="voice-meta">
          Suggested: {consult.suggested_specialty}
          {consult.status === 'active' ? (
            <>
              {' '}
              · <Link to={`/doctors`}>Book / call a doctor</Link>
            </>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
    </main>
  )
}
