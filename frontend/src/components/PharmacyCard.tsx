import { Clock3, MapPinned, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { distanceLabel, taka } from '../lib/format'
import { pharmacyImage } from '../lib/uploadUrl'
import type { Pharmacy } from '../types'

export function PharmacyCard({ pharmacy }: { pharmacy: Pharmacy }) {
  return (
    <Link
      to={`/pharmacies/${pharmacy.id}`}
      className={`pharmacy-card${!pharmacy.is_open ? ' closed' : ''}`}
    >
      <img src={pharmacyImage(pharmacy.image_url)} alt="" />
      <div className="meta">
        <h3>{pharmacy.name}</h3>
        <div className="sub">
          {pharmacy.area} · Min {taka(pharmacy.min_order)}
          {pharmacy.review_count ? ` · ${pharmacy.review_count} reviews` : ''}
        </div>
        <div className="row-stats">
          <span className="pill">
            <Star size={12} fill="#F5A623" color="#F5A623" />
            {pharmacy.rating.toFixed(1)}
          </span>
          <span className="pill">
            <Clock3 size={12} />
            {pharmacy.delivery_minutes} min
          </span>
          <span className="pill">{taka(pharmacy.delivery_fee)}</span>
          {pharmacy.distance_km != null ? (
            <span className="pill">
              <MapPinned size={12} />
              {distanceLabel(pharmacy.distance_km)}
            </span>
          ) : null}
          {pharmacy.accepts_rx ? <span className="pill rx">Rx</span> : null}
          {pharmacy.delivery_minutes <= 30 ? (
            <span className="pill teal">Fast</span>
          ) : null}
          {!pharmacy.is_open ? <span className="pill warn">Closed</span> : null}
        </div>
      </div>
    </Link>
  )
}
