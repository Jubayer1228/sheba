import { useQuery } from '@tanstack/react-query'
import { MapPin, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalogApi } from '../api/endpoints'
import { useLocationStore } from '../stores/locationStore'
import { Spinner } from './Spinner'

const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  Dhanmondi: { lat: 23.7461, lng: 90.3742 },
  Gulshan: { lat: 23.7925, lng: 90.4078 },
  Banani: { lat: 23.7937, lng: 90.4066 },
  Uttara: { lat: 23.8759, lng: 90.3795 },
  Mirpur: { lat: 23.8223, lng: 90.3654 },
  Mohammadpur: { lat: 23.7658, lng: 90.3585 },
  Motijheel: { lat: 23.733, lng: 90.4172 },
  Bashundhara: { lat: 23.8151, lng: 90.4349 },
  Wari: { lat: 23.711, lng: 90.418 },
  Tejgaon: { lat: 23.7598, lng: 90.3914 },
  Farmgate: { lat: 23.7563, lng: 90.39 },
  'Bailey Road': { lat: 23.7415, lng: 90.4078 },
}

export function LocationPicker({ onClose }: { onClose: () => void }) {
  const { area, city, setLocation } = useLocationStore()
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['areas', city],
    queryFn: () => catalogApi.areas(city),
  })

  const filtered = useMemo(() => {
    const list = data ?? []
    if (!q.trim()) return list
    const needle = q.toLowerCase()
    return list.filter((a) => a.area.toLowerCase().includes(needle))
  }, [data, q])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-title"
      >
        <div className="modal-head">
          <h2 id="loc-title">Delivery location</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
          Choose your area in {city} to see nearby pharmacies.
        </p>
        <div className="search-wrap" style={{ marginBottom: 12, boxShadow: 'none' }}>
          <MapPin size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search areas…"
            autoFocus
          />
        </div>
        {isLoading ? <Spinner /> : null}
        <div>
          {filtered.map((row) => {
            const coords = AREA_COORDS[row.area] ?? { lat: 23.7461, lng: 90.3742 }
            const active = row.area === area
            return (
              <button
                key={row.area}
                type="button"
                className={`area-item${active ? ' active' : ''}`}
                onClick={() => {
                  setLocation({
                    area: row.area,
                    city,
                    lat: coords.lat,
                    lng: coords.lng,
                  })
                  onClose()
                }}
              >
                <span>{row.area}</span>
                <span className="muted" style={{ fontWeight: 600 }}>
                  {row.count} pharmacies
                </span>
              </button>
            )
          })}
          {!isLoading && filtered.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: 16 }}>
              No areas found
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
