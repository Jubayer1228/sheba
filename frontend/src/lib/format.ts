import { formatDistanceToNow } from 'date-fns'
import type { OrderStatus } from '../types'

export function taka(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function distanceLabel(km?: number): string {
  if (km == null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

export function orderStatusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    placed: 'Placed',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'On the way',
    delivered: 'Delivered',
    picked_up: 'Picked up',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

export function medPrice(m: { effective_price?: number; price: number }): number {
  return m.effective_price != null && m.effective_price > 0
    ? m.effective_price
    : m.price
}
