import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MapPinned, Navigation, Phone } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { orderApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { useLiveTracking } from '../hooks/useLiveTracking'
import { orderStatusLabel, relativeTime, taka } from '../lib/format'
import type { OrderStatus } from '../types'

const LiveTrackingMap = lazy(() =>
  import('../components/LiveTrackingMap').then((m) => ({ default: m.LiveTrackingMap })),
)

const FLOW_DELIVERY: OrderStatus[] = [
  'placed',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
]

const FLOW_PICKUP: OrderStatus[] = [
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
]

function stepState(
  flow: OrderStatus[],
  current: OrderStatus,
  step: OrderStatus,
): 'done' | 'current' | 'todo' {
  if (current === 'cancelled') return 'todo'
  const ci = flow.indexOf(current)
  const si = flow.indexOf(step)
  if (ci < 0 || si < 0) return 'todo'
  if (si < ci) return 'done'
  if (si === ci) return 'current'
  return 'todo'
}

export function OrderDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewMsg, setReviewMsg] = useState('')

  const orderQ = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      if (!s || s === 'delivered' || s === 'picked_up' || s === 'cancelled') return false
      return 3000
    },
  })

  const order = orderQ.data
  const { tracking, error: trackError } = useLiveTracking(id, order?.status, order?.type)

  // When GPS stream marks delivered, refresh order card
  useEffect(() => {
    if (tracking?.status === 'delivered') {
      void queryClient.invalidateQueries({ queryKey: ['order', id] })
    }
  }, [tracking?.status, id, queryClient])

  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const complete = useMutation({
    mutationFn: () => orderApi.complete(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const review = useMutation({
    mutationFn: () => {
      if (!order) throw new Error('Order not loaded')
      return orderApi.review({
        pharmacy_id: order.pharmacy_id,
        order_id: order.id,
        rating,
        comment,
      })
    },
    onSuccess: () => setReviewMsg('Thanks for your review!'),
    onError: (err: Error) => setReviewMsg(err.message),
  })

  if (orderQ.isLoading) {
    return (
      <main className="page">
        <Spinner />
      </main>
    )
  }

  if (!order) {
    return (
      <main className="page">
        <EmptyState title="Order not found" action={<Link to="/orders">Back to orders</Link>} />
      </main>
    )
  }

  const liveStatus = tracking?.status || order.status
  const flow = order.type === 'pickup' ? FLOW_PICKUP : FLOW_DELIVERY
  const canCancel = liveStatus === 'placed' || liveStatus === 'confirmed'
  const canComplete =
    liveStatus === 'out_for_delivery' ||
    liveStatus === 'ready' ||
    liveStatus === 'preparing'
  const isDone = liveStatus === 'delivered' || liveStatus === 'picked_up'
  const showMap = order.type === 'delivery' && tracking

  return (
    <main className="page">
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem' }}>{order.order_number}</h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {order.pharmacy?.name} · {relativeTime(order.created_at)}
          </p>
        </div>
        <span
          className={`status-badge ${
            isDone ? 'done' : liveStatus === 'cancelled' ? 'cancelled' : ''
          }`}
        >
          {orderStatusLabel(liveStatus)}
        </span>
      </div>

      {showMap ? (
        <section className="card-panel" style={{ marginBottom: 12 }}>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.05rem' }}>Live map</h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                {tracking.is_live
                  ? 'Rider is moving toward you'
                  : liveStatus === 'delivered'
                    ? 'Delivered at your pin'
                    : 'Waiting for rider pickup'}
              </p>
            </div>
            {tracking.is_live ? <span className="live-dot">Live GPS</span> : null}
          </div>

          <div className="tracking-hud">
            <div className="stat">
              <strong>
                {tracking.is_live || tracking.eta_minutes
                  ? `~${tracking.eta_minutes || 1} min`
                  : isDone
                    ? 'Arrived'
                    : '—'}
              </strong>
              <span>ETA</span>
            </div>
            <div className="stat">
              <strong>
                {tracking.distance_remaining_km > 0.05
                  ? `${tracking.distance_remaining_km.toFixed(1)} km`
                  : isDone
                    ? '0 km'
                    : `${Math.max(tracking.distance_remaining_km, 0).toFixed(2)} km`}
              </strong>
              <span>Remaining</span>
            </div>
            <div className="stat">
              <strong>
                {tracking.is_live ? `${Math.round(tracking.rider_speed_kmh)} km/h` : '—'}
              </strong>
              <span>Speed</span>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="live-map-shell" style={{ display: 'grid', placeItems: 'center' }}>
                <Spinner />
              </div>
            }
          >
            <LiveTrackingMap tracking={tracking} />
          </Suspense>

          <div
            className="flex-between"
            style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Navigation size={16} color="#0f9f8a" />
              <div>
                <strong>{tracking.rider_name || 'Rider assigning…'}</strong>
                <div className="muted" style={{ fontSize: '0.82rem' }}>
                  {tracking.area_label
                    ? `Near ${tracking.area_label}`
                    : tracking.destination_address}
                  {tracking.rider_updated_at
                    ? ` · updated ${relativeTime(tracking.rider_updated_at)}`
                    : ''}
                </div>
              </div>
            </div>
            {tracking.rider_phone ? (
              <a
                className="btn btn-primary"
                href={`tel:${tracking.rider_phone}`}
                style={{ padding: '8px 12px' }}
              >
                <Phone size={16} />
                Call rider
              </a>
            ) : null}
          </div>
          {trackError ? (
            <p className="error-text" style={{ marginTop: 8 }}>
              {trackError}
            </p>
          ) : null}
        </section>
      ) : null}

      {order.status !== 'cancelled' ? (
        <section className="card-panel" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: '1rem', marginBottom: 8 }}>Status</h2>
          {order.estimated_minutes && !isDone ? (
            <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
              Estimated ~{order.estimated_minutes} minutes from pharmacy prep
            </p>
          ) : null}
          <div className="timeline">
            {flow.map((step) => {
              const state = stepState(flow, liveStatus, step)
              return (
                <div key={step} className={`timeline-step ${state}`}>
                  <div className="timeline-dot">
                    {state === 'done' ? <Check size={12} /> : null}
                  </div>
                  <div>
                    <strong>{orderStatusLabel(step)}</strong>
                    {(order.status_history ?? [])
                      .filter((h) => h.status === step)
                      .slice(-1)
                      .map((h) => (
                        <div key={h.id} className="muted" style={{ fontSize: '0.82rem' }}>
                          {h.note} · {relativeTime(h.created_at)}
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="card-panel" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Items</h2>
        {(order.items ?? []).map((item) => (
          <div key={item.id} className="flex-between" style={{ marginBottom: 8 }}>
            <span>
              {item.quantity}× {item.name}
              {item.strength ? ` ${item.strength}` : ''}
              {item.requires_rx ? ' · Rx' : ''}
            </span>
            <strong>{taka(item.total_price)}</strong>
          </div>
        ))}
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{taka(order.subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Delivery</span>
          <span>{taka(order.delivery_fee)}</span>
        </div>
        <div className="summary-row total">
          <span>Total · {order.payment_method.toUpperCase()}</span>
          <span>{taka(order.total)}</span>
        </div>
      </section>

      {order.type === 'delivery' ? (
        <section className="card-panel" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: '1rem', marginBottom: 6 }}>
            <MapPinned size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
            Deliver to
          </h2>
          <p>
            {order.customer_name} · {order.customer_phone}
          </p>
          <p className="muted" style={{ marginTop: 4 }}>
            {order.delivery_address}
            {order.delivery_area ? `, ${order.delivery_area}` : ''}
            {order.delivery_city ? `, ${order.delivery_city}` : ''}
          </p>
        </section>
      ) : null}

      <div className="stack-gap" style={{ marginBottom: 12 }}>
        {canCancel ? (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Cancel this order?')) cancel.mutate()
            }}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
          </button>
        ) : null}
        {canComplete ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={complete.isPending}
            onClick={() => complete.mutate()}
          >
            {complete.isPending
              ? 'Updating…'
              : order.type === 'pickup'
                ? 'Mark as picked up'
                : 'Mark as delivered'}
          </button>
        ) : null}
      </div>

      {isDone ? (
        <section className="card-panel">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Rate pharmacy</h2>
          <div className="field">
            <label htmlFor="rating">Rating</label>
            <select
              id="rating"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="comment">Comment</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was the service?"
            />
          </div>
          {reviewMsg ? <p className="muted">{reviewMsg}</p> : null}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={review.isPending}
            onClick={() => review.mutate()}
          >
            Submit review
          </button>
        </section>
      ) : null}
    </main>
  )
}
