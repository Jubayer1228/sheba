import { Link } from 'react-router-dom'
import type { Category } from '../types'

const BLURBS: Record<string, string> = {
  'fever-pain': 'Napa, Ace & more',
  'cold-cough': 'Syrups & allergy',
  stomach: 'Gastric & ORS',
  antibiotics: 'Rx required',
  diabetes: 'Chronic refills',
  'heart-bp': 'Cardiac care',
  vitamins: 'Daily support',
  baby: 'Infant care',
  skin: 'Creams & ointments',
  'first-aid': 'Home kit',
}

export function CategoryChips({
  categories,
}: {
  categories: Category[]
  activeSlug?: string
}) {
  return (
    <div className="category-scroll" role="list">
      {categories.map((c) => (
        <Link
          key={c.id}
          to={`/categories/${c.slug}`}
          className="category-chip"
          role="listitem"
        >
          {c.name}
          <span>{BLURBS[c.slug] || c.description || 'Browse'}</span>
        </Link>
      ))}
    </div>
  )
}
