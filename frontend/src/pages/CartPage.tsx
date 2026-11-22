import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { QuantityControl } from '../components/QuantityControl'
import { medPrice, taka } from '../lib/format'
import { pharmacyImage } from '../lib/uploadUrl'
import { useCartStore } from '../stores/cartStore'

export function CartPage() {
  const navigate = useNavigate()
  const pharmacy = useCartStore((s) => s.pharmacy)
  const items = useCartStore((s) => s.items)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const clear = useCartStore((s) => s.clear)
  const subtotal = useCartStore((s) => s.subtotal())
  const requiresRx = useCartStore((s) => s.requiresRx())

  if (!pharmacy || items.length === 0) {
    return (
      <main className="page">
        <h1 style={{ fontSize: '1.35rem', marginBottom: 8 }}>Cart</h1>
        <EmptyState
          title="Your cart is empty"
          description="Browse a pharmacy and add medicines."
          action={
            <Link to="/" className="btn btn-primary">
              Find pharmacies
            </Link>
          }
        />
      </main>
    )
  }

  const deliveryFee = pharmacy.delivery_fee
  const belowMin = subtotal < pharmacy.min_order

  return (
    <main className="page">
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: '1.35rem' }}>Cart</h1>
        <button type="button" className="btn btn-ghost" onClick={clear}>
          Clear
        </button>
      </div>

      <div className="card-panel" style={{ marginBottom: 12 }}>
        <Link to={`/pharmacies/${pharmacy.id}`} className="flex-between">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img
              src={pharmacyImage(pharmacy.image_url)}
              alt=""
              style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }}
            />
            <div>
              <strong>{pharmacy.name}</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {pharmacy.area} · {pharmacy.delivery_minutes} min
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="medicine-list">
        {items.map((item) => {
          const price = medPrice(item.medicine)
          return (
            <article key={item.medicine.id} className="medicine-card">
              <img src={pharmacyImage(item.medicine.image_url)} alt="" />
              <div>
                <h4>
                  {item.medicine.name}
                  {item.medicine.strength ? ` ${item.medicine.strength}` : ''}
                </h4>
                <div className="generic">{taka(price)} each</div>
                {item.medicine.requires_rx ? <span className="pill pink">Rx</span> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <QuantityControl
                  value={item.quantity}
                  onChange={(n) => setQuantity(item.medicine.id, n)}
                />
                <div style={{ marginTop: 8, fontWeight: 800 }}>{taka(price * item.quantity)}</div>
              </div>
            </article>
          )
        })}
      </div>

      {requiresRx ? (
        <div className="card-panel" style={{ marginTop: 12, background: '#fff0f6' }}>
          <strong>Prescription required</strong>
          <p className="muted" style={{ marginTop: 4, fontSize: '0.9rem' }}>
            You’ll need to attach or upload a prescription at checkout.
          </p>
          <Link to="/prescription" className="linkish" style={{ display: 'inline-block', marginTop: 8 }}>
            Upload prescription
          </Link>
        </div>
      ) : null}

      <div className="card-panel" style={{ marginTop: 12 }}>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{taka(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Delivery fee</span>
          <span>{taka(deliveryFee)}</span>
        </div>
        <div className="summary-row total">
          <span>Estimated total</span>
          <span>{taka(subtotal + deliveryFee)}</span>
        </div>
        {belowMin ? (
          <p className="error-text" style={{ marginTop: 8 }}>
            Minimum order is {taka(pharmacy.min_order)}. Add {taka(pharmacy.min_order - subtotal)} more.
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={belowMin}
          onClick={() => navigate('/checkout')}
        >
          Checkout
        </button>
      </div>
    </main>
  )
}
