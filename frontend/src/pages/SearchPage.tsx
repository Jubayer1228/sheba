import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { catalogApi, pharmacyApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { MedicineCard } from '../components/MedicineCard'
import { PharmacyCard } from '../components/PharmacyCard'
import { Spinner } from '../components/Spinner'
import { useLocationStore } from '../stores/locationStore'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [submitted, setSubmitted] = useState(initial)
  const { lat, lng, city } = useLocationStore()

  const medsQ = useQuery({
    queryKey: ['search-meds', submitted, lat, lng],
    queryFn: () => catalogApi.searchMedicines(submitted, { lat, lng }),
    enabled: submitted.length > 0,
  })

  const pharmaciesQ = useQuery({
    queryKey: ['search-pharmacies', submitted, lat, lng, city],
    queryFn: () => pharmacyApi.list({ q: submitted, lat, lng, city, sort: 'distance' }),
    enabled: submitted.length > 0,
  })

  const featuredQ = useQuery({
    queryKey: ['featured'],
    queryFn: catalogApi.featured,
    enabled: !submitted,
  })

  const meds = useMemo(() => medsQ.data ?? [], [medsQ.data])
  const pharmacies = useMemo(() => pharmaciesQ.data ?? [], [pharmaciesQ.data])

  return (
    <main className="page">
      <h1 style={{ fontSize: '1.35rem', marginBottom: 12 }}>Search</h1>
      <form
        className="search-wrap"
        onSubmit={(e) => {
          e.preventDefault()
          const next = q.trim()
          setSubmitted(next)
          setParams(next ? { q: next } : {})
        }}
      >
        <SearchIcon size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Napa, antibiotic, Lazz Pharma…"
          autoFocus
        />
      </form>

      {!submitted ? (
        <>
          <div className="section-head">
            <h2>Featured medicines</h2>
          </div>
          {featuredQ.isLoading ? <Spinner /> : null}
          <div className="medicine-list">
            {(featuredQ.data ?? []).map((m) =>
              m.pharmacy ? (
                <MedicineCard
                  key={`${m.pharmacy_id}-${m.id}`}
                  medicine={m}
                  pharmacy={m.pharmacy}
                  showPharmacy
                />
              ) : null,
            )}
          </div>
          {!featuredQ.isLoading && (featuredQ.data ?? []).length === 0 ? (
            <EmptyState
              title="Start searching"
              description="Find medicines or pharmacies near you."
            />
          ) : null}
        </>
      ) : (
        <>
          {(medsQ.isLoading || pharmaciesQ.isLoading) && <Spinner />}

          <div className="section-head">
            <h2>Pharmacies</h2>
          </div>
          {pharmacies.length === 0 && !pharmaciesQ.isLoading ? (
            <p className="muted">No pharmacies matched “{submitted}”.</p>
          ) : (
            <div className="pharmacy-grid">
              {pharmacies.map((p) => (
                <PharmacyCard key={p.id} pharmacy={p} />
              ))}
            </div>
          )}

          <div className="section-head">
            <h2>Medicines</h2>
          </div>
          {meds.length === 0 && !medsQ.isLoading ? (
            <EmptyState
              title="No medicines found"
              description="Try a brand or generic name."
              action={<Link to="/">Browse pharmacies</Link>}
            />
          ) : (
            <div className="medicine-list">
              {meds.map((m) =>
                m.pharmacy ? (
                  <MedicineCard
                    key={`${m.pharmacy_id}-${m.id}`}
                    medicine={m}
                    pharmacy={m.pharmacy}
                    showPharmacy
                  />
                ) : null,
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
