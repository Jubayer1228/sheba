import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock3, MapPinned, Phone, ShieldCheck, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { catalogApi, pharmacyApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { MedicineCard } from '../components/MedicineCard'
import { Spinner } from '../components/Spinner'
import { distanceLabel, taka } from '../lib/format'
import { pharmacyImage } from '../lib/uploadUrl'
import { useCartStore } from '../stores/cartStore'
import { useLocationStore } from '../stores/locationStore'

export function PharmacyDetailPage() {
  const { id } = useParams()
  const { lat, lng } = useLocationStore()
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [rxOnly, setRxOnly] = useState(false)
  const cartCount = useCartStore((s) => s.itemCount())
  const cartTotal = useCartStore((s) => s.subtotal())
  const cartPharmacy = useCartStore((s) => s.pharmacy)

  const pharmacyQ = useQuery({
    queryKey: ['pharmacy', id, lat, lng],
    queryFn: () => pharmacyApi.get(id!, { lat, lng }),
    enabled: !!id,
  })

  const medicinesQ = useQuery({
    queryKey: ['pharmacy-meds', id, categoryId, q, rxOnly],
    queryFn: () =>
      pharmacyApi.medicines(id!, {
        category_id: categoryId,
        q: q.trim() || undefined,
        rx: rxOnly,
      }),
    enabled: !!id,
  })

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.categories,
  })

  const pharmacy = pharmacyQ.data
  const meds = useMemo(() => medicinesQ.data ?? [], [medicinesQ.data])

  if (pharmacyQ.isLoading) {
    return (
      <main className="page">
        <Spinner />
      </main>
    )
  }

  if (!pharmacy) {
    return (
      <main className="page">
        <EmptyState title="Pharmacy not found" action={<Link to="/">Go home</Link>} />
      </main>
    )
  }

  const cartHere = cartPharmacy?.id === pharmacy.id && cartCount > 0

  return (
    <main className="page">
      <Link to="/" className="nav-link" style={{ marginBottom: 16, width: 'fit-content' }}>
        <ArrowLeft size={16} /> Back to pharmacies
      </Link>

      <div className="page-split">
        <div>
          <section
            className="card-panel"
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              gap: 20,
              marginBottom: 20,
              alignItems: 'center',
            }}
          >
            <img
              src={pharmacyImage(pharmacy.image_url)}
              alt=""
              style={{
                width: 140,
                height: 140,
                borderRadius: 16,
                objectFit: 'cover',
              }}
            />
            <div>
              <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>{pharmacy.name}</h1>
              <p className="muted" style={{ marginBottom: 10 }}>
                {pharmacy.address || `${pharmacy.area}, ${pharmacy.city}`}
              </p>
              <div className="row-stats">
                <span className="pill">
                  <Star size={12} fill="#D97706" color="#D97706" />
                  {pharmacy.rating.toFixed(1)} ({pharmacy.review_count})
                </span>
                <span className="pill">
                  <Clock3 size={12} />
                  {pharmacy.delivery_minutes} min
                </span>
                <span className="pill">{taka(pharmacy.delivery_fee)} delivery</span>
                {pharmacy.distance_km != null ? (
                  <span className="pill">
                    <MapPinned size={12} />
                    {distanceLabel(pharmacy.distance_km)}
                  </span>
                ) : null}
                {pharmacy.accepts_rx ? <span className="pill rx">Accepts Rx</span> : null}
                {pharmacy.is_open ? (
                  <span className="pill teal">Open now</span>
                ) : (
                  <span className="pill warn">Closed</span>
                )}
              </div>
              {pharmacy.description ? (
                <p className="muted" style={{ marginTop: 12, lineHeight: 1.45 }}>
                  {pharmacy.description}
                </p>
              ) : null}
            </div>
          </section>

          <div className="search-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search medicines in this pharmacy"
            />
          </div>

          <div className="filters">
            <button
              type="button"
              className={`filter-btn${!categoryId ? ' active' : ''}`}
              onClick={() => setCategoryId(undefined)}
            >
              All
            </button>
            {(categoriesQ.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`filter-btn${categoryId === c.id ? ' active' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              className={`filter-btn${rxOnly ? ' active' : ''}`}
              onClick={() => setRxOnly((v) => !v)}
            >
              Rx only
            </button>
          </div>

          <div className="section-head">
            <div>
              <h2>Medicines</h2>
              <p>Min order {taka(pharmacy.min_order)}</p>
            </div>
          </div>

          {medicinesQ.isLoading ? <Spinner /> : null}
          {!medicinesQ.isLoading && meds.length === 0 ? (
            <EmptyState title="No medicines found" description="Try another category or search." />
          ) : null}

          <div className="medicine-list">
            {meds.map((m) => (
              <MedicineCard key={m.id} medicine={m} pharmacy={pharmacy} />
            ))}
          </div>
        </div>

        <aside className="cart-rail">
          <h3>Order from this shop</h3>
          <div className="stack-gap" style={{ marginTop: 8 }}>
            <p className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>
              <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Fulfillment by <strong>{pharmacy.name}</strong> — a named partner, not a warehouse.
            </p>
            {pharmacy.phone ? (
              <p className="muted" style={{ fontSize: '0.88rem' }}>
                <Phone size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                Pharmacist line {pharmacy.phone}
              </p>
            ) : null}
            {cartHere ? (
              <>
                <p>
                  <strong>
                    {cartCount} item{cartCount > 1 ? 's' : ''} · {taka(cartTotal)}
                  </strong>
                </p>
                <Link to="/cart" className="btn btn-primary btn-block">
                  Review cart
                </Link>
                <Link to="/checkout" className="btn btn-ghost btn-block">
                  Checkout
                </Link>
              </>
            ) : (
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                Add medicines to build your cart. Need Rx?{' '}
                <Link to="/prescription" className="linkish">
                  Upload prescription
                </Link>
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
