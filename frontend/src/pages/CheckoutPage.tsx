import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addressApi, orderApi, prescriptionApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { taka } from '../lib/format'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useLocationStore } from '../stores/locationStore'
import type { OrderType, PaymentMethod } from '../types'

export function CheckoutPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const location = useLocationStore()
  const pharmacy = useCartStore((s) => s.pharmacy)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal())
  const requiresRx = useCartStore((s) => s.requiresRx())
  const prescriptionId = useCartStore((s) => s.prescriptionId)
  const setPrescriptionId = useCartStore((s) => s.setPrescriptionId)
  const clear = useCartStore((s) => s.clear)

  const [type, setType] = useState<OrderType>('delivery')
  const [payment, setPayment] = useState<PaymentMethod>('cod')
  const [addressId, setAddressId] = useState<number | 'manual'>('manual')
  const [line1, setLine1] = useState('')
  const [notes, setNotes] = useState('')
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [error, setError] = useState('')
  const addressesQ = useQuery({
    queryKey: ['addresses'],
    queryFn: addressApi.list,
  })

  useEffect(() => {
    if (!addressesQ.data?.length) return
    const preferred =
      addressesQ.data.find((a) => a.is_default) ?? addressesQ.data[0]
    if (preferred) setAddressId(preferred.id)
  }, [addressesQ.data])

  const rxQ = useQuery({
    queryKey: ['prescriptions'],
    queryFn: prescriptionApi.list,
    enabled: requiresRx,
  })

  const selectedAddress = useMemo(() => {
    if (addressId === 'manual') return null
    return (addressesQ.data ?? []).find((a) => a.id === addressId) ?? null
  }, [addressId, addressesQ.data])

  const deliveryFee = type === 'delivery' && pharmacy ? pharmacy.delivery_fee : 0
  const belowMin = pharmacy ? subtotal < pharmacy.min_order : false

  const placeOrder = useMutation({
    mutationFn: orderApi.create,
    onSuccess: (order) => {
      clear()
      navigate(`/orders/${order.id}`, { replace: true })
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!pharmacy || items.length === 0) {
    return (
      <main className="page">
        <EmptyState
          title="Nothing to checkout"
          action={<Link to="/">Browse pharmacies</Link>}
        />
      </main>
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (belowMin) {
      setError(`Minimum order is ${taka(pharmacy!.min_order)}`)
      return
    }

    if (requiresRx && !prescriptionId) {
      setError('Please select or upload a prescription for Rx medicines.')
      return
    }

    const delivery_address =
      type === 'delivery'
        ? selectedAddress
          ? selectedAddress.line1
          : line1.trim()
        : undefined

    if (type === 'delivery' && !delivery_address) {
      setError('Delivery address is required.')
      return
    }

    placeOrder.mutate({
      pharmacy_id: pharmacy!.id,
      type,
      payment_method: payment,
      items: items.map((i) => ({
        medicine_id: i.medicine.id,
        quantity: i.quantity,
      })),
      prescription_id: prescriptionId ?? undefined,
      delivery_address,
      delivery_area: selectedAddress?.area || location.area,
      delivery_city: selectedAddress?.city || location.city,
      delivery_lat: selectedAddress?.latitude || location.lat,
      delivery_lng: selectedAddress?.longitude || location.lng,
      customer_name: name,
      customer_phone: phone,
      notes,
    })
  }

  return (
    <main className="page">
      <h1 style={{ fontSize: '1.35rem', marginBottom: 12 }}>Checkout</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Ordering from <strong>{pharmacy.name}</strong>
      </p>

      <form onSubmit={submit} className="stack-gap">
        <section className="card-panel">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Fulfillment</h2>
          <div className="radio-row">
            {pharmacy.has_delivery ? (
              <label className={`radio-option${type === 'delivery' ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  checked={type === 'delivery'}
                  onChange={() => setType('delivery')}
                />
                Delivery · {taka(pharmacy.delivery_fee)} · ~{pharmacy.delivery_minutes} min
              </label>
            ) : null}
            {pharmacy.has_pickup ? (
              <label className={`radio-option${type === 'pickup' ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  checked={type === 'pickup'}
                  onChange={() => setType('pickup')}
                />
                Pickup at pharmacy
              </label>
            ) : null}
          </div>
        </section>

        {type === 'delivery' ? (
          <section className="card-panel">
            <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Delivery address</h2>
            {addressesQ.isLoading ? <Spinner /> : null}
            <div className="radio-row">
              {(addressesQ.data ?? []).map((a) => (
                <label
                  key={a.id}
                  className={`radio-option${addressId === a.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="addr"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                  />
                  <span>
                    <strong>{a.label}</strong>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {a.line1}, {a.area}, {a.city}
                    </div>
                  </span>
                </label>
              ))}
              <label className={`radio-option${addressId === 'manual' ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="addr"
                  checked={addressId === 'manual'}
                  onChange={() => setAddressId('manual')}
                />
                Enter address for {location.area}
              </label>
            </div>
            {addressId === 'manual' ? (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label htmlFor="line1">Address</label>
                <input
                  id="line1"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder={`House / road, ${location.area}`}
                  required={type === 'delivery'}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="card-panel">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Contact</h2>
          <div className="field">
            <label htmlFor="cname">Name</label>
            <input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="cphone">Phone</label>
            <input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
        </section>

        {requiresRx ? (
          <section className="card-panel">
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: '1rem' }}>Prescription</h2>
              <Link to="/prescription" className="linkish">
                Upload new
              </Link>
            </div>
            {rxQ.isLoading ? <Spinner /> : null}
            <div className="radio-row">
              {(rxQ.data ?? []).map((rx) => (
                <label
                  key={rx.id}
                  className={`radio-option${prescriptionId === rx.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="rx"
                    checked={prescriptionId === rx.id}
                    onChange={() => setPrescriptionId(rx.id)}
                  />
                  <span>
                    <strong>{rx.file_name || `Rx #${rx.id}`}</strong>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {rx.status}
                      {rx.patient_name ? ` · ${rx.patient_name}` : ''}
                    </div>
                  </span>
                </label>
              ))}
            </div>
            {(rxQ.data ?? []).length === 0 ? (
              <p className="muted">No prescriptions yet. Upload one first.</p>
            ) : null}
          </section>
        ) : null}

        <section className="card-panel">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Payment</h2>
          <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 12 }}>
            We never ask for your bKash or Nagad PIN. Prefer COD for first orders,
            or pay in the MFS app and keep the transaction ID for support.
          </p>
          <div className="radio-row">
            {(
              [
                ['cod', 'Cash on delivery (recommended first order)'],
                ['bkash', 'bKash — pay in app, no PIN to Sheba'],
                ['nagad', 'Nagad — pay in app, no PIN to Sheba'],
                ['card', 'Card'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`radio-option${payment === value ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="pay"
                  checked={payment === value}
                  onChange={() => setPayment(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="card-panel">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Gate code, call on arrival…"
            />
          </div>
        </section>

        <section className="card-panel">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{taka(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>{type === 'delivery' ? 'Delivery' : 'Pickup'}</span>
            <span>{taka(deliveryFee)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{taka(subtotal + deliveryFee)}</span>
          </div>
          {belowMin ? (
            <p className="error-text" style={{ marginTop: 8 }}>
              Add {taka(pharmacy.min_order - subtotal)} more to reach the{' '}
              {taka(pharmacy.min_order)} minimum.
            </p>
          ) : null}
          {error ? <p className="error-text" style={{ marginTop: 8 }}>{error}</p> : null}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            disabled={placeOrder.isPending || belowMin}
          >
            {placeOrder.isPending ? 'Placing order…' : 'Place order'}
          </button>
        </section>
      </form>
    </main>
  )
}
