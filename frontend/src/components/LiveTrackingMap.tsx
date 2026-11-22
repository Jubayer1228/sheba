import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import type { LiveTracking } from '../types'
import 'leaflet/dist/leaflet.css'

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: 'sheba-map-pin',
    html: `<div style="
      display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);
    ">
      <div style="
        background:${color};color:#fff;font:700 11px Figtree,sans-serif;
        padding:4px 8px;border-radius:999px;box-shadow:0 6px 16px rgba(12,27,42,.25);
        white-space:nowrap;
      ">${label}</div>
      <div style="
        width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;
        border-top:10px solid ${color};
      "></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function riderIcon(heading: number) {
  return L.divIcon({
    className: 'sheba-rider-pin',
    html: `<div style="
      width:36px;height:36px;border-radius:50%;background:#0f9f8a;border:3px solid #fff;
      box-shadow:0 8px 20px rgba(15,159,138,.45);display:grid;place-items:center;
      transform:translate(-50%,-50%) rotate(${heading}deg);color:#fff;font-size:16px;
    ">➤</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function FitBounds({ tracking }: { tracking: LiveTracking }) {
  const map = useMap()
  const routeKey = `${tracking.pharmacy_lat},${tracking.destination_lat},${tracking.route?.length ?? 0}`

  useEffect(() => {
    const pts: L.LatLngExpression[] = [
      [tracking.pharmacy_lat, tracking.pharmacy_lng],
      [tracking.destination_lat, tracking.destination_lng],
    ]
    for (const p of tracking.route ?? []) pts.push([p.lat, p.lng])
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 })
    }
    // Fit once when route is known — don't fight live panTo on each GPS tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, map])

  return null
}

function FollowRider({ tracking }: { tracking: LiveTracking }) {
  const map = useMap()
  useEffect(() => {
    if (!tracking.is_live || !tracking.rider_lat) return
    map.panTo([tracking.rider_lat, tracking.rider_lng], { animate: true, duration: 0.75 })
  }, [tracking.rider_lat, tracking.rider_lng, tracking.is_live, map])
  return null
}

export function LiveTrackingMap({ tracking }: { tracking: LiveTracking }) {
  const center = useMemo<[number, number]>(
    () => [tracking.rider_lat || tracking.pharmacy_lat, tracking.rider_lng || tracking.pharmacy_lng],
    [tracking.rider_lat, tracking.rider_lng, tracking.pharmacy_lat, tracking.pharmacy_lng],
  )

  const routeLine = useMemo(
    () => (tracking.route ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [tracking.route],
  )

  const traveled = useMemo(() => {
    if (!routeLine.length) return [] as [number, number][]
    const idx = Math.max(1, Math.floor(tracking.progress * (routeLine.length - 1)))
    return routeLine.slice(0, idx + 1)
  }, [routeLine, tracking.progress])

  return (
    <div className="live-map-shell">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', borderRadius: 16 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds tracking={tracking} />
        <FollowRider tracking={tracking} />

        {routeLine.length > 1 ? (
          <Polyline positions={routeLine} pathOptions={{ color: '#94a3b8', weight: 5, opacity: 0.55 }} />
        ) : null}
        {traveled.length > 1 ? (
          <Polyline positions={traveled} pathOptions={{ color: '#0f9f8a', weight: 5, opacity: 0.95 }} />
        ) : null}

        <Marker
          position={[tracking.pharmacy_lat, tracking.pharmacy_lng]}
          icon={pinIcon('#0c1b2a', 'Pharmacy')}
        >
          <Popup>{tracking.pharmacy_name}</Popup>
        </Marker>

        <Marker
          position={[tracking.destination_lat, tracking.destination_lng]}
          icon={pinIcon('#e11d48', 'You')}
        >
          <Popup>{tracking.destination_address || 'Delivery address'}</Popup>
        </Marker>

        {tracking.rider_lat ? (
          <Marker
            position={[tracking.rider_lat, tracking.rider_lng]}
            icon={riderIcon(tracking.rider_heading || 0)}
          >
            <Popup>
              {tracking.rider_name || 'Rider'}
              {tracking.is_live ? ' · live' : ''}
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  )
}
