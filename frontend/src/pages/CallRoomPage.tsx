import { useMutation, useQuery } from '@tanstack/react-query'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { callApi } from '../api/endpoints'
import { useWebRTCCall } from '../hooks/useWebRTCCall'
import { useAuthStore } from '../stores/authStore'

function VideoPane({
  stream,
  muted,
  mirror,
  label,
}: {
  stream: MediaStream | null
  muted?: boolean
  mirror?: boolean
  label: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return (
    <div className="call-pane">
      <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? 'mirror' : ''} />
      {!stream ? <div className="call-pane-empty">{label}</div> : null}
      <span className="call-pane-label">{label}</span>
    </div>
  )
}

export function CallRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [answered, setAnswered] = useState(false)

  const callQ = useQuery({
    queryKey: ['call', id],
    queryFn: () => callApi.get(id!),
    enabled: !!id,
    refetchInterval: 2000,
  })

  const answerMut = useMutation({
    mutationFn: () => callApi.answer(id!),
    onSuccess: () => {
      setAnswered(true)
      void callQ.refetch()
    },
  })

  const call = callQ.data?.call
  const appt = callQ.data?.appointment
  const isDoctor = user?.id === call?.doctor_id
  const isCaller = !!call && user?.id === call.started_by
  const mediaReady =
    !!call &&
    !!user &&
    (call.status === 'active' || (call.status === 'ringing' && isCaller) || answered)

  // Keep local answered flag in sync; doctors must tap Answer while ringing
  useEffect(() => {
    if (call?.status === 'active') setAnswered(true)
  }, [call?.status])

  // If patient already answered somehow / reconnect, enable media
  useEffect(() => {
    if (call?.status === 'ringing' && user?.id === call.started_by) setAnswered(true)
  }, [call?.status, call?.started_by, user?.id])

  const webrtc = useWebRTCCall({
    callId: Number(id),
    userId: user?.id || 0,
    mode: call?.mode || 'video',
    isCaller: isCaller && (call?.status === 'ringing' || call?.status === 'active'),
    enabled: mediaReady && (call?.status === 'ringing' || call?.status === 'active' || answered),
  })

  if (!user) {
    return (
      <main className="page">
        <Link to="/login">Sign in</Link>
      </main>
    )
  }

  if (!call) {
    return (
      <main className="page">
        <p className="muted">Connecting to call…</p>
      </main>
    )
  }

  const peerName = isDoctor ? call.patient?.name : call.doctor?.name
  const phoneOnly = call.mode === 'phone'
  const peerInitial = (peerName || '?')
    .replace(/^dr\.?\s+/i, '')
    .trim()
    .slice(0, 1)
    .toUpperCase()

  return (
    <main className="call-room" data-testid="call-room">
      <header className="call-room-head">
        <div>
          <p className="eyebrow">{call.mode.toUpperCase()} CALL</p>
          <h1>{peerName || 'Sheba Care'}</h1>
          <p>
            Status: <span className="pill">{call.status}</span> · WebRTC {webrtc.status}
            {appt ? ` · appt #${appt.id}` : ''}
          </p>
        </div>
      </header>

      {call.status === 'ringing' && isDoctor && !answered ? (
        <div className="incoming-banner call-incoming" data-testid="incoming-banner">
          <div>
            <strong>Incoming {call.mode} call</strong>
            <p>{call.patient?.name || 'Patient'} is calling you</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="answer-call"
            disabled={answerMut.isPending}
            onClick={() => answerMut.mutate()}
          >
            Answer
          </button>
        </div>
      ) : null}

      <div className={`call-stage${phoneOnly ? ' phone' : ''}`}>
        {phoneOnly ? (
          <div className="phone-stage">
            <div className="phone-avatar">{peerInitial || '?'}</div>
            <p>
              {call.status === 'active' || webrtc.status === 'live'
                ? 'Connected'
                : isDoctor && !answered
                  ? 'Incoming…'
                  : 'Ringing…'}
            </p>
            <audio
              autoPlay
              ref={(el) => {
                if (el) el.srcObject = webrtc.remoteStream
              }}
            />
          </div>
        ) : (
          <>
            <VideoPane stream={webrtc.remoteStream} label={peerName || 'Remote'} />
            <VideoPane stream={webrtc.localStream} muted mirror label="You" />
          </>
        )}
      </div>

      {webrtc.error ? (
        <p className="error-text">
          Media: {webrtc.error}. Allow camera/mic, or continue audio-only after granting permission.
        </p>
      ) : null}

      <div className="call-controls">
        <button type="button" className="ctrl-btn" onClick={webrtc.toggleMute} aria-label="Mute">
          {webrtc.muted ? <MicOff /> : <Mic />}
        </button>
        {!phoneOnly ? (
          <button type="button" className="ctrl-btn" onClick={webrtc.toggleCam} aria-label="Camera">
            {webrtc.camOff ? <VideoOff /> : <Video />}
          </button>
        ) : null}
        <button
          type="button"
          className="ctrl-btn hangup"
          data-testid="hangup"
          onClick={async () => {
            await webrtc.hangup(call)
            navigate(isDoctor ? '/doctor' : `/appointments/${call.appointment_id}`)
          }}
        >
          <PhoneOff />
        </button>
      </div>
    </main>
  )
}
