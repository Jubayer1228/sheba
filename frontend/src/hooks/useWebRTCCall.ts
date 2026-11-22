import { useCallback, useEffect, useRef, useState } from 'react'
import { callApi } from '../api/endpoints'
import type { AppointmentMode, CallSession } from '../types'

const ICE: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

type Options = {
  callId: number
  userId: number
  mode: AppointmentMode
  isCaller: boolean
  enabled: boolean
}

export function useWebRTCCall({ callId, userId, mode, isCaller, enabled }: Options) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const lastSignalRef = useRef(0)
  const handledRef = useRef<Set<number>>(new Set())
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'ended' | 'error'>('idle')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(mode === 'phone')

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
  }, [])

  const postSignal = useCallback(
    async (kind: string, payload: unknown) => {
      await callApi.postSignal(callId, { kind, payload: JSON.stringify(payload) })
    },
    [callId],
  )

  useEffect(() => {
    if (!enabled || !callId) return
    let cancelled = false

    async function boot() {
      try {
        setStatus('connecting')
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: mode === 'video' ? { width: 640, height: 480 } : false,
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        setLocalStream(stream)
        if (mode === 'phone') {
          stream.getVideoTracks().forEach((t) => {
            t.enabled = false
          })
        }

        const pc = new RTCPeerConnection(ICE)
        pcRef.current = pc
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))
        pc.ontrack = (ev) => {
          const [remote] = ev.streams
          if (remote) setRemoteStream(remote)
          setStatus('live')
        }
        pc.onicecandidate = (ev) => {
          if (ev.candidate) void postSignal('ice', ev.candidate)
        }
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') setStatus('live')
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setStatus('ended')
          }
        }

        if (isCaller) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await postSignal('offer', offer)
        }
      } catch (err) {
        setError((err as Error).message || 'Could not access camera/mic')
        setStatus('error')
      }
    }

    void boot()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [enabled, callId, mode, isCaller, postSignal, cleanup])

  useEffect(() => {
    if (!enabled || !callId) return
    const timer = window.setInterval(async () => {
      try {
        const sigs = await callApi.signals(callId, lastSignalRef.current)
        const pc = pcRef.current
        for (const s of sigs) {
          lastSignalRef.current = Math.max(lastSignalRef.current, s.id)
          if (handledRef.current.has(s.id) || s.from_user_id === userId) continue
          handledRef.current.add(s.id)
          if (s.kind === 'hangup') {
            setStatus('ended')
            cleanup()
            continue
          }
          if (!pc) continue
          const payload = JSON.parse(s.payload)
          if (s.kind === 'offer' && !isCaller) {
            await pc.setRemoteDescription(payload)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await postSignal('answer', answer)
          } else if (s.kind === 'answer' && isCaller) {
            await pc.setRemoteDescription(payload)
          } else if (s.kind === 'ice') {
            try {
              await pc.addIceCandidate(payload)
            } catch {
              /* ignore late candidates */
            }
          }
        }
      } catch {
        /* polling hiccup */
      }
    }, 800)
    return () => window.clearInterval(timer)
  }, [enabled, callId, userId, isCaller, postSignal, cleanup])

  const toggleMute = () => {
    const next = !muted
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
    setMuted(next)
  }

  const toggleCam = () => {
    if (mode === 'phone') return
    const next = !camOff
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next
    })
    setCamOff(next)
  }

  const hangup = async (session?: CallSession) => {
    try {
      await postSignal('hangup', { reason: 'user' })
      if (session) await callApi.end(session.id)
      else await callApi.end(callId)
    } catch {
      /* ignore */
    }
    cleanup()
    setStatus('ended')
  }

  return {
    localStream,
    remoteStream,
    status,
    error,
    muted,
    camOff,
    toggleMute,
    toggleCam,
    hangup,
  }
}
