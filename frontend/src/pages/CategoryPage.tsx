import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pill } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { catalogApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { MedicineCard } from '../components/MedicineCard'
import { Spinner } from '../components/Spinner'

type SortKey = 'featured' | 'price_asc' | 'price_desc' | 'name'

export function CategoryPage() {
  const { slug = '' } = useParams()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('featured')
  const [rxOnly, setRxOnly] = useState(false)
  const [submitted, setSubmitted] = useState('')

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.categories,
  })

  const detailQ = useQuery({
    queryKey: ['category', slug, submitted, sort, rxOnly],
    queryFn: () =>
      catalogApi.categoryMedicines(slug, {
        q: submitted || undefined,
        sort,
        rx: rxOnly,
      }),
    enabled: !!slug,
  })

  const category = detailQ.data?.category
  const medicines = useMemo(() => detailQ.data?.medicines ?? [], [detailQ.data])
  const siblings = categoriesQ.data ?? []

  return (
    <main className="page">
      <Link to="/" className="nav-link" style={{ width: 'fit-content', marginBottom: 12 }}>
        <ArrowLeft size={16} /> Home
      </Link>

      <section className="category-hero">
        <div>
          <p className="eyebrow-tag">Medicine category</p>
          <h1>{category?.name || 'Category'}</h1>
          <p>
            {category?.description ||
              'Browse verified pharmacy stock in this category — compare price, pack, and Rx needs.'}
          </p>
          <div className="row-stats" style={{ marginTop: 12 }}>
            <span className="pill teal">
              <Pill size={12} />
              {medicines.length} listings
            </span>
            {rxOnly ? <span className="pill rx">Rx filter on</span> : null}
          </div>
        </div>
        <form
          className="search-wrap"
          style={{ marginBottom: 0 }}
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(q.trim())
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search in ${category?.name || 'category'}…`}
          />
        </form>
      </section>

      <div className="category-sibling-rail">
        {siblings.map((c) => (
          <Link
            key={c.id}
            to={`/categories/${c.slug}`}
            className={`filter-btn${c.slug === slug ? ' active' : ''}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="filters">
        {(
          [
            ['featured', 'Featured'],
            ['price_asc', 'Price ↑'],
            ['price_desc', 'Price ↓'],
            ['name', 'Name'],
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
          className={`filter-btn${rxOnly ? ' active' : ''}`}
          onClick={() => setRxOnly((v) => !v)}
        >
          Rx only
        </button>
      </div>

      {detailQ.isLoading ? <Spinner /> : null}
      {detailQ.isError ? (
        <EmptyState title="Category unavailable" description={(detailQ.error as Error).message} />
      ) : null}
      {!detailQ.isLoading && medicines.length === 0 ? (
        <EmptyState
          title="No medicines in this category"
          description="Try clearing filters or browse another category."
          action={
            <Link to="/prescription" className="btn btn-primary">
              Upload prescription instead
            </Link>
          }
        />
      ) : null}

      <div className="medicine-grid">
        {medicines.map((m) =>
          m.pharmacy ? (
            <MedicineCard key={m.id} medicine={m} pharmacy={m.pharmacy} showPharmacy />
          ) : null,
        )}
      </div>
    </main>
  )
}
