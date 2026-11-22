import { useQuery } from '@tanstack/react-query'
import {
  Clock3,
  FileUp,
  Moon,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { catalogApi, pharmacyApi } from '../api/endpoints'
import { BannerCarousel } from '../components/BannerCarousel'
import { CategoryChips } from '../components/CategoryChips'
import { EmptyState } from '../components/EmptyState'
import { MedicineCard } from '../components/MedicineCard'
import { PharmacyCard } from '../components/PharmacyCard'
import { Spinner } from '../components/Spinner'
import { useCartStore } from '../stores/cartStore'
import { useLocationStore } from '../stores/locationStore'
import { taka } from '../lib/format'

type SortKey = 'distance' | 'rating' | 'delivery_fee' | 'fastest'

export function HomePage() {
  const { lat, lng, city, area } = useLocationStore()
  const [params] = useSearchParams()
  const [sort, setSort] = useState<SortKey>('fastest')
  const [openOnly, setOpenOnly] = useState(params.get('night') === '1')
  const [rxOnly, setRxOnly] = useState(false)
  const cartPharmacy = useCartStore((s) => s.pharmacy)
  const cartCount = useCartStore((s) => s.itemCount())
  const cartTotal = useCartStore((s) => s.subtotal())

  const bannersQ = useQuery({ queryKey: ['banners'], queryFn: catalogApi.banners })
  const categoriesQ = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories })
  const featuredQ = useQuery({ queryKey: ['featured'], queryFn: catalogApi.featured })
  const pharmaciesQ = useQuery({
    queryKey: ['pharmacies', lat, lng, city, area, sort, openOnly, rxOnly],
    queryFn: () =>
      pharmacyApi.list({
        lat,
        lng,
        city,
        area,
        sort,
        open: openOnly,
        rx: rxOnly,
      }),
  })

  const pharmacies = useMemo(() => pharmaciesQ.data ?? [], [pharmaciesQ.data])
  const featured = useMemo(() => (featuredQ.data ?? []).slice(0, 6), [featuredQ.data])
  const avgMins = useMemo(() => {
    if (!pharmacies.length) return 35
    return Math.round(
      pharmacies.slice(0, 5).reduce((s, p) => s + p.delivery_minutes, 0) /
        Math.min(5, pharmacies.length),
    )
  }, [pharmacies])

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Sparkles size={14} />
            Neighborhood pharmacy network · {area}
          </div>
          <h1>Sheba</h1>
          <p>
            Order from pharmacies you already trust — delivered in under an hour,
            with prescription upload, COD, and no bKash PIN sharing.
          </p>
          <div className="hero-actions">
            <Link to="/search" className="btn btn-primary">
              Find medicines
            </Link>
            <Link to="/prescription" className="btn btn-signal">
              <FileUp size={16} />
              Upload prescription
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-stat">
            <strong>~{avgMins} min</strong>
            <span>Typical delivery near {area} right now</span>
          </div>
          <div className="hero-stat">
            <strong>{pharmacies.length || '—'} shops</strong>
            <span>Partner pharmacies within your city map</span>
          </div>
          <div className="hero-stat">
            <strong>Named partner</strong>
            <span>Every order shows which pharmacy fulfills it</span>
          </div>
        </div>
      </section>

      <section className="trust-rail" aria-label="Why Sheba works in Bangladesh">
        <article className="trust-card">
          <div className="icon">
            <Clock3 size={18} />
          </div>
          <div>
            <h3>Hyperlocal speed</h3>
            <p>Sick now ≠ next-day parcel. We route to open shops nearby.</p>
          </div>
        </article>
        <article className="trust-card">
          <div className="icon">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3>Authenticity trail</h3>
            <p>Partner invoice + sealed pack cues against counterfeit risk.</p>
          </div>
        </article>
        <article className="trust-card">
          <div className="icon">
            <Wallet size={18} />
          </div>
          <div>
            <h3>Safe MFS payments</h3>
            <p>COD, bKash & Nagad via txn ID — we never ask for your PIN.</p>
          </div>
        </article>
        <article className="trust-card">
          <div className="icon">
            <Users size={18} />
          </div>
          <div>
            <h3>Family ordering</h3>
            <p>Office workers ordering for parents at home — dual address ready.</p>
          </div>
        </article>
      </section>

      <BannerCarousel banners={bannersQ.data ?? []} />

      <div className="section-head">
        <div>
          <h2>Shop by need</h2>
          <p>Fever tonight, chronic refills, baby care — start here.</p>
        </div>
        <Link to="/search" className="linkish">
          See all
        </Link>
      </div>
      {categoriesQ.isLoading ? <Spinner /> : <CategoryChips categories={categoriesQ.data ?? []} />}

      <section className="feature-band">
        <article className="feature-card accent">
          <span className="tag">Someone is sick</span>
          <h3>Rx → nearest open pharmacy</h3>
          <p>
            Upload a prescription once. We list partners that accept Rx, show ETA
            and fee, then let a pharmacist confirm the cart before you pay.
          </p>
          <Link to="/prescription" className="btn btn-primary" style={{ marginTop: 14 }}>
            Start with prescription
          </Link>
        </article>
        <article className="feature-card">
          <span className="tag">Chronic care</span>
          <h3>Refills without the queue</h3>
          <p>
            Diabetes, BP, thyroid — save your usual medicines and reorder from the
            same trusted counter your family already uses.
          </p>
          <Link to="/search?q=diabetes" className="btn btn-ghost" style={{ marginTop: 14 }}>
            Browse chronic meds
          </Link>
        </article>
        <article className="feature-card">
          <span className="tag">
            <Moon size={12} style={{ display: 'inline', verticalAlign: -1 }} /> Late night
          </span>
          <h3>When retail shutters</h3>
          <p>
            Filter partners still open after hours. A small urgency fee beats an
            empty cupboard at 1am.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 14 }}
            onClick={() => {
              setOpenOnly(true)
              setSort('fastest')
              window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' })
            }}
          >
            Show open now
          </button>
        </article>
      </section>

      <div className="page-split">
        <div>
          <div className="section-head">
            <div>
              <h2>Pharmacies near {area}</h2>
              <p>Compare distance, fee, and minutes — pick the counter you trust.</p>
            </div>
          </div>

          <div className="filters">
            {(
              [
                ['fastest', 'Fastest'],
                ['distance', 'Nearest'],
                ['rating', 'Top rated'],
                ['delivery_fee', 'Lowest fee'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-btn${sort === key ? ' active' : ''}`}
                onClick={() => setSort(key)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`filter-btn${openOnly ? ' active' : ''}`}
              onClick={() => setOpenOnly((v) => !v)}
            >
              Open now
            </button>
            <button
              type="button"
              className={`filter-btn${rxOnly ? ' active' : ''}`}
              onClick={() => setRxOnly((v) => !v)}
            >
              Accepts Rx
            </button>
          </div>

          {pharmaciesQ.isLoading ? <Spinner /> : null}
          {pharmaciesQ.isError ? (
            <EmptyState
              title="Couldn’t load pharmacies"
              description={(pharmaciesQ.error as Error).message}
            />
          ) : null}
          {!pharmaciesQ.isLoading && pharmacies.length === 0 ? (
            <EmptyState
              title="No pharmacies match"
              description="Try another area or clear filters."
            />
          ) : null}

          <div className="pharmacy-grid">
            {pharmacies.map((p) => (
              <PharmacyCard key={p.id} pharmacy={p} />
            ))}
          </div>

          {featured.length > 0 ? (
            <>
              <div className="section-head" style={{ marginTop: 36 }}>
                <div>
                  <h2>Popular right now</h2>
                  <p>Compare the same brand across partner shops when you search.</p>
                </div>
                <Link to="/search?q=napa" className="linkish">
                  Search Napa
                </Link>
              </div>
              <div className="medicine-grid home-featured">
                {featured.map((m) =>
                  m.pharmacy ? (
                    <MedicineCard
                      key={m.id}
                      medicine={m}
                      pharmacy={m.pharmacy}
                      showPharmacy
                    />
                  ) : null,
                )}
              </div>
            </>
          ) : null}
        </div>

        <aside className="cart-rail" aria-label="Cart summary">
          <h3>Your cart</h3>
          {cartPharmacy && cartCount > 0 ? (
            <div className="stack-gap">
              <p>
                <strong>{cartPharmacy.name}</strong>
              </p>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                {cartCount} item{cartCount > 1 ? 's' : ''} · {taka(cartTotal)}
              </p>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Min order {taka(cartPharmacy.min_order)} · Delivery{' '}
                {taka(cartPharmacy.delivery_fee)}
              </p>
              <Link to="/cart" className="btn btn-primary btn-block">
                Review cart
              </Link>
              <Link to="/checkout" className="btn btn-ghost btn-block">
                Checkout
              </Link>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: '0.92rem', lineHeight: 1.45 }}>
              Add medicines from one pharmacy to unlock delivery or pickup. Switching
              shops clears the cart — same as ordering from a single counter.
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}
