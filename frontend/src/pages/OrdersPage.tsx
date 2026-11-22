import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { orderApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { orderStatusLabel, relativeTime, taka } from '../lib/format'
import type { OrderStatus } from '../types'

function statusClass(status: OrderStatus): string {
  if (status === 'delivered' || status === 'picked_up') return 'done'
  if (status === 'cancelled') return 'cancelled'
  return ''
}

export function OrdersPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['orders'],
    queryFn: orderApi.list,
    refetchInterval: 8000,
  })

  return (
    <main className="page">
      <h1 style={{ fontSize: '1.35rem', marginBottom: 16 }}>Orders</h1>
      {isLoading ? <Spinner /> : null}
      {isError ? (
        <EmptyState title="Couldn’t load orders" description={(error as Error).message} />
      ) : null}
      {!isLoading && (data ?? []).length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When you place an order, tracking shows up here."
          action={
            <Link to="/" className="btn btn-primary">
              Order medicines
            </Link>
          }
        />
      ) : null}

      {(data ?? []).map((order) => (
        <Link key={order.id} to={`/orders/${order.id}`} className="order-card">
          <div className="flex-between">
            <div>
              <strong>{order.pharmacy?.name || `Order #${order.id}`}</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {order.order_number} · {relativeTime(order.created_at)}
              </div>
            </div>
            <span className={`status-badge ${statusClass(order.status)}`}>
              {orderStatusLabel(order.status)}
            </span>
          </div>
          <div className="flex-between" style={{ marginTop: 10 }}>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              {(order.items ?? []).length} item
              {(order.items ?? []).length === 1 ? '' : 's'} · {order.type}
            </span>
            <strong>{taka(order.total)}</strong>
          </div>
        </Link>
      ))}
    </main>
  )
}
