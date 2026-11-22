import { Minus, Plus } from 'lucide-react'
import { medPrice, taka } from '../lib/format'
import { pharmacyImage } from '../lib/uploadUrl'
import { useCartStore } from '../stores/cartStore'
import type { Medicine, Pharmacy } from '../types'

export function MedicineCard({
  medicine,
  pharmacy,
  showPharmacy = false,
}: {
  medicine: Medicine
  pharmacy: Pharmacy
  showPharmacy?: boolean
}) {
  const items = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const cartPharmacy = useCartStore((s) => s.pharmacy)

  const inCart =
    cartPharmacy?.id === pharmacy.id
      ? items.find((i) => i.medicine.id === medicine.id)
      : undefined

  const price = medPrice(medicine)
  const hasDiscount = medicine.discount_pct > 0

  return (
    <article className="medicine-card">
      <img src={pharmacyImage(medicine.image_url)} alt="" />
      <div style={{ minWidth: 0 }}>
        <h4>
          {medicine.name}
          {medicine.strength ? ` ${medicine.strength}` : ''}
        </h4>
        <div className="generic">
          {medicine.generic_name || medicine.brand}
          {medicine.pack_size ? ` · ${medicine.pack_size}` : ''}
        </div>
        {showPharmacy && medicine.pharmacy ? (
          <div className="generic">{medicine.pharmacy.name}</div>
        ) : null}
        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong>{taka(price)}</strong>
          {hasDiscount ? (
            <span className="muted" style={{ textDecoration: 'line-through', fontSize: '0.8rem' }}>
              {taka(medicine.price)}
            </span>
          ) : null}
          {medicine.requires_rx ? <span className="pill rx">Rx</span> : null}
        </div>
      </div>
      <div>
        {inCart ? (
          <div className="qty-ctrl">
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => setQuantity(medicine.id, inCart.quantity - 1)}
            >
              <Minus size={14} />
            </button>
            <span>{inCart.quantity}</span>
            <button
              type="button"
              aria-label="Increase"
              onClick={() => setQuantity(medicine.id, inCart.quantity + 1)}
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            disabled={!pharmacy.is_open || medicine.stock <= 0}
            onClick={() => addItem(medicine, pharmacy)}
          >
            Add
          </button>
        )}
      </div>
    </article>
  )
}
