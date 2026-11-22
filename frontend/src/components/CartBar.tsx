import { useNavigate } from 'react-router-dom'
import { taka } from '../lib/format'
import { useCartStore } from '../stores/cartStore'

/** Mobile-only sticky cart (desktop uses home/pharmacy side rail + header badge). */
export function CartBar() {
  const navigate = useNavigate()
  const pharmacy = useCartStore((s) => s.pharmacy)
  const count = useCartStore((s) => s.itemCount())
  const subtotal = useCartStore((s) => s.subtotal())

  if (!pharmacy || count === 0) return null

  return (
    <div className="cart-bar">
      <div className="left">
        <strong>
          {count} item{count > 1 ? 's' : ''} · {taka(subtotal)}
        </strong>
        <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>{pharmacy.name}</span>
      </div>
      <button type="button" className="cta" onClick={() => navigate('/cart')}>
        View cart
      </button>
    </div>
  )
}
