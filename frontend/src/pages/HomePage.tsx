import { useQuery } from '@tanstack/react-query'
import {
  Clock3,
  FileUp,
  MapPinned,
  Moon,
  ShieldCheck,
  Sparkles,
  Store,
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
import { PharmacyGridSkeleton } from '../components/PharmacyGridSkeleton'
import { useCartStore } from '../stores/cartStore'
import { useLocationStore } from '../stores/locationStore'
import { taka } from '../lib/format'

type SortKey = 'distance' | 'rating' | 'delivery_fee' | 'fastest'

const NEARBY_KM = 8

export function HomePage() {
  const { lat, lng, city, area } = useLocationStore()
  const [params] = useSearchParams()
  const [sort, setSort] = useState<SortKey>(
    params.get('night') === '1' ? 'fastest' : 'distance',
  )
  const [openOnly, setOpenOnly] = useState(params.get('night') === '1')
  const [rxOnly, setRxOnly] = useState(false)
  const cartPharmacy = useCartStore((s) => s.pharmacy)
  const cartCount = useCartStore((s) => s.itemCount())
  const cartTotal = useCartStore((s) => s.subtotal())

  const bannersQ = useQuery({ queryKey: ['banners'], queryFn: catalogApi.banners })
  const categoriesQ = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories })
  const featuredQ = useQuery({ queryKey: ['featured'], queryFn: catalogApi.featured })
  const pharmaciesQ = useQuery({
    queryKey: ['pharmacies', lat, lng, city, sort, openOnly, rxOnly],
    queryFn: () =>
      pharmacyApi.list({
        lat,
        lng,
        city,
        sort,
        open: openOnly,
        rx: rxOnly,
      }),
  })

  const pharmacies = useMemo(() => pharmaciesQ.data ?? [], [pharmaciesQ.data])
  const featured = useMemo(() => (featuredQ.data ?? []).slice(0, 6), [featuredQ.data])

  const stats = useMemo(() => {
    const open = pharmacies.filter((p) => p.is_open)
    const nearby = pharmacies.filter(
      (p) => p.distance_km != null && p.distance_km <= NEARBY_KM,
    )
    const inArea = pharmacies.filter(
      (p) => p.area.toLowerCase() === area.toLowerCase(),
    )
    const etaPool = open.length ? open : pharmacies
    const fastest =
      etaPool.length > 0
        ? Math.min(...etaPool.map((p) => p.delivery_minutes))
        : null
    const avgMins =
      etaPool.length > 0
        ? Math.round(
            etaPool.slice(0, 6).reduce((s, p) => s + p.delivery_minutes, 0) /
              Math.min(6, etaPool.length),
          )
        : null
  return {
      open: open.length,
      nearby: nearby.length,
      inArea: inArea.length,
      total: pharmacies.length,
      fastest,
      avgMins,
    }
  }, [pharmacies, area])

  return (
    <main className="page home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Sparkles size={14} />
            Live pharmacy catalog · {city}
          </div>
          <h1>
            Real shops. Real stock.
            <span className="hero-subline"> Delivered from named partners.</span>
          </h1>
          <p>
            Browse partner pharmacies in Dhaka, compare ETA and fees, upload Rx when
            needed, and pay with COD or mobile money — we never ask for your PIN.
          </p>
          <div className="hero-actions">
            <Link to="/search" className="btn btn-primary">
              Search medicines
            </Link>
            <Link to="/prescription" className="btn btn-secondary-on-dark">
              <FileUp size={16} />
              Upload prescription
            </Link>
          </div>
        </div>

        <div className="hero-panel" aria-live="polite">
          <div className="hero-stat hero-stat--accent">
            <strong>{stats.fastest != null ? `${stats.fastest} min` : '—'}</strong>
            <span>Fastest quoted delivery from open partners</span>
          </div>
          <div className="hero-stat">
            <strong>{stats.total || '—'}</strong>
            <span>
              Partner pharmacies in {city}
              {stats.nearby > 0 ? ` · ${stats.nearby} within ${NEARBY_KM} km` : ''}
            </span>
          </div>
          <div className="hero-stat">
            <strong>{stats.open}</strong>
            <span>
              Open for orders now
              {stats.inArea > 0 ? ` (${stats.inArea} counters in ${area})` : ''}
            </span>
          </div>
        </div>
      </section>

      <section className="trust-rail" aria-label="How Sheba works">
        <article className="trust-card">
          <div className="icon">
            <Store size={18} />
          </div>
          <div>
            <h3>Named pharmacy</h3>
            <p>Every cart and invoice shows which partner shop fulfills the order.</p>
          </div>
        </article>
        <article className="trust-card">
          <div className="icon">
            <Clock3 size={18} />
          </div>
          <div>
            <h3>Live ETAs</h3>
            <p>
              Delivery minutes and fees come from each shop&apos;s profile — not ads.
            </p>
          </div>
        </article>
        <article className="trust-card">
          <div className="icon">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3>Rx verified</h3>
            <p>Prescription lines stay locked until a pharmacist accepts your upload.</p>
          </div>
        </article>
        <article className="trust-card">
          <div className="icon">
            <Wallet size={18} />
          </div>
          <div>
            <h3>Local payments</h3>
            <p>COD, bKash, or Nagad with transaction ID — no OTP sharing on chat.</p>
          </div>
        </article>
      </section>

      <BannerCarousel banners={bannersQ.data ?? []} />

      <div className="section-head">
        <div>
          <h2>Shop by need</h2>
          <p>Categories loaded from the catalog — tap to search medicines.</p>
        </div>
        <Link to="/search" className="linkish">
          Browse all
        </Link>
      </div>
      {categoriesQ.isLoading ? (
        <div className="skeleton-chips" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="skeleton-pill" />
          ))}
        </div>
      ) : (
        <CategoryChips categories={categoriesQ.data ?? []} />
      )}

      <section className="feature-band">
        <article className="feature-card accent">
          <span className="tag">Prescription</span>
          <h3>Rx → pharmacist review</h3>
          <p>
            Upload once. We only show pharmacies that accept Rx in your city, with
            minimum order and fee visible before checkout.
          </p>
          <Link to="/prescription" className="btn btn-primary" style={{ marginTop: 14 }}>
            Upload prescription
          </Link>
        </article>
        <article className="feature-card">
          <span className="tag">Telehealth</span>
          <h3>Chat or voice triage</h3>
          <p>
            English live agent suggests specialty, matches doctors, and can route to
            phone or video consults.
          </p>
          <Link to="/consult" className="btn btn-ghost" style={{ marginTop: 14 }}>
            Open health chat
          </Link>
        </article>
        <article className="feature-card">
          <span className="tag">
            <Moon size={12} style={{ display: 'inline', verticalAlign: -1 }} /> Late night
          </span>
          <h3>Still open</h3>
          <p>Filter partners that are open now, sorted by fastest delivery.</p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 14 }}
            onClick={() => {
              setOpenOnly(true)
              setSort('fastest')
              document.getElementById('pharmacy-list')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Show open now
          </button>
        </article>
      </section>

      <div className="page-split">
        <div id="pharmacy-list">
          <div className="section-head">
            <div>
              <h2>Delivering near {area}</h2>
              <p>
                <MapPinned
                  size={14}
                  style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }}
                />
                Sorted by {sort === 'distance' ? 'distance from your pin' : sort.replace('_', ' ')}
                {stats.avgMins != null ? ` · ~${stats.avgMins} min avg among top picks` : ''}
              </p>
            </div>
          </div>

          <div className="filters">
            {(
              [
                ['distance', 'Nearest'],
                ['fastest', 'Fastest'],
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

          {pharmaciesQ.isLoading ? <PharmacyGridSkeleton /> : null}
          {pharmaciesQ.isError ? (
            <EmptyState
              title="Couldn’t load pharmacies"
              description={(pharmaciesQ.error as Error).message}
            />
          ) : null}
          {!pharmaciesQ.isLoading && !pharmaciesQ.isError && pharmacies.length === 0 ? (
            <EmptyState
              title="No pharmacies match"
              description="Try another location or clear filters."
            />
          ) : null}

          {!pharmaciesQ.isLoading && pharmacies.length > 0 ? (
            <div className="pharmacy-grid">
              {pharmacies.map((p) => (
                <PharmacyCard key={p.id} pharmacy={p} />
              ))}
            </div>
          ) : null}

          {featured.length > 0 ? (
            <>
              <div className="section-head" style={{ marginTop: 36 }}>
                <div>
                  <h2>Featured in catalog</h2>
                  <p>Live prices from partner inventory — tap to add from that shop.</p>
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
              Items stay with one pharmacy at a time — prices and stock come from that
              shop&apos;s live catalog.
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}