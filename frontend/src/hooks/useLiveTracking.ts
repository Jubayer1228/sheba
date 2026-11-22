import { useEffect, useState } from 'react'
import { orderApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import type { LiveTracking, OrderStatus } from '../types'

export function useLiveTracking(
  orderId: string | undefined,
  orderStatus: OrderStatus | undefined,
  orderType: string | undefined,
) {
  const token = useAuthStore((s) => s.token)
  const [tracking, setTracking] = useState<LiveTracking | null>(null)
  const [error, setError] = useState('')

  const wantsLive =
    !!orderId &&
    orderType === 'delivery' &&
    !!orderStatus &&
    orderStatus !== 'cancelled' &&
    orderStatus !== 'delivered' &&
    orderStatus !== 'picked_up'

  useEffect(() => {
    if (!orderId || orderType !== 'delivery') return

    let cancelled = false
    let es: EventSource | null = null
    let poll: number | undefined

    const pull = async () => {
      try {
        const data = await orderApi.tracking(orderId)
        if (!cancelled) {
          setTracking(data)
          setError('')
        }
        return data
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
        return null
      }
    }

    void pull()

    if (wantsLive && token) {
      // SSE for second-by-second GPS (Amazon-style)
      es = new EventSource(`/api/orders/${orderId}/live?token=${encodeURIComponent(token)}`)
      es.addEventListener('tracking', (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as { data: LiveTracking }
          if (!cancelled) {
            setTracking(parsed.data)
            setError('')
          }
          if (
            parsed.data.status === 'delivered' ||
            parsed.data.status === 'cancelled' ||
            !parsed.data.is_live
          ) {
            // keep last frame; polling will refresh status
          }
        } catch {
          /* ignore malformed */
        }
      })
      es.onerror = () => {
        // Fallback poll if SSE drops
        es?.close()
        poll = window.setInterval(() => {
          void pull()
        }, 1500)
      }
    } else if (orderStatus === 'delivered' || orderStatus === 'out_for_delivery') {
      void pull()
    }

    return () => {
      cancelled = true
      es?.close()
      if (poll) window.clearInterval(poll)
    }
  }, [orderId, orderType, orderStatus, wantsLive, token])

  return { tracking, error }
}
