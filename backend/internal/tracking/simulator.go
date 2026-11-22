package tracking

import (
	"math"
	"sync"
	"time"

	"github.com/sheba/pharmacy/internal/models"
)

type RideState struct {
	OrderID      uint
	Route        []models.GeoPoint
	Progress     float64 // 0..1
	SpeedKmh     float64
	Heading      float64
	Lat          float64
	Lng          float64
	UpdatedAt    time.Time
	Active       bool
	PharmacyName string
	DestAddress  string
	PharmacyLat  float64
	PharmacyLng  float64
	DestLat      float64
	DestLng      float64
	RiderName    string
	RiderPhone   string
	OrderNumber  string
	AreaLabel    string
}

type Hub struct {
	mu    sync.RWMutex
	rides map[uint]*RideState
}

func NewHub() *Hub {
	return &Hub{rides: map[uint]*RideState{}}
}

func (h *Hub) StartRide(order *models.Order, pharmacy *models.Pharmacy) {
	if order.Type != models.OrderDelivery || pharmacy == nil {
		return
	}
	destLat, destLng := order.DeliveryLat, order.DeliveryLng
	if destLat == 0 && destLng == 0 {
		destLat, destLng = pharmacy.Latitude+0.008, pharmacy.Longitude-0.006
	}
	route := buildRoute(pharmacy.Latitude, pharmacy.Longitude, destLat, destLng)
	h.mu.Lock()
	defer h.mu.Unlock()
	h.rides[order.ID] = &RideState{
		OrderID:      order.ID,
		Route:        route,
		Progress:     0,
		SpeedKmh:     18 + float64(order.ID%7),
		Lat:          route[0].Lat,
		Lng:          route[0].Lng,
		UpdatedAt:    time.Now(),
		Active:       true,
		PharmacyName: pharmacy.Name,
		DestAddress:  order.DeliveryAddress,
		PharmacyLat:  pharmacy.Latitude,
		PharmacyLng:  pharmacy.Longitude,
		DestLat:      destLat,
		DestLng:      destLng,
		RiderName:    order.RiderName,
		RiderPhone:   order.RiderPhone,
		OrderNumber:  order.OrderNumber,
		AreaLabel:    order.DeliveryArea,
	}
}

func (h *Hub) Stop(orderID uint) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r, ok := h.rides[orderID]; ok {
		r.Active = false
		r.Progress = 1
	}
}

func (h *Hub) Tick(orderID uint) (*RideState, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r, ok := h.rides[orderID]
	if !ok || !r.Active {
		return r, false
	}
	// Advance along route (~Amazon-like continuous movement, ~45–70s trip)
	step := 0.018 + (r.SpeedKmh / 1800)
	r.Progress = math.Min(1, r.Progress+step)
	lat, lng, heading := pointOnRoute(r.Route, r.Progress)
	r.Lat, r.Lng, r.Heading = lat, lng, heading
	r.UpdatedAt = time.Now()
	if r.Progress >= 1 {
		r.Active = false
		r.SpeedKmh = 0
	}
	cp := *r
	return &cp, true
}

func (h *Hub) Snapshot(orderID uint) (*RideState, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	r, ok := h.rides[orderID]
	if !ok {
		return nil, false
	}
	cp := *r
	return &cp, true
}

func buildRoute(lat1, lng1, lat2, lng2 float64) []models.GeoPoint {
	// Multi-segment path with slight curves so the marker doesn't go in a straight line
	n := 24
	pts := make([]models.GeoPoint, 0, n+1)
	for i := 0; i <= n; i++ {
		t := float64(i) / float64(n)
		// ease-in-out
		te := t * t * (3 - 2*t)
		lat := lat1 + (lat2-lat1)*te
		lng := lng1 + (lng2-lng1)*te
		// perpendicular wobble for "road-like" path
		dx, dy := lng2-lng1, lat2-lat1
		norm := math.Hypot(dx, dy)
		if norm > 0 {
			px, py := -dy/norm, dx/norm
			wobble := math.Sin(t*math.Pi*2.5) * 0.0026 * (1 - math.Abs(2*t-1))
			lat += py * wobble
			lng += px * wobble
			// slight mid-route detour so short neighborhood hops still read on the map
			lat += math.Sin(t*math.Pi) * 0.0012
			lng += math.Sin(t*math.Pi*0.5) * 0.0010
		}
		pts = append(pts, models.GeoPoint{Lat: lat, Lng: lng})
	}
	return pts
}

func pointOnRoute(route []models.GeoPoint, progress float64) (lat, lng, heading float64) {
	if len(route) == 0 {
		return 0, 0, 0
	}
	if progress <= 0 {
		return route[0].Lat, route[0].Lng, bearing(route[0], route[min(1, len(route)-1)])
	}
	if progress >= 1 {
		last := route[len(route)-1]
		prev := route[max(0, len(route)-2)]
		return last.Lat, last.Lng, bearing(prev, last)
	}
	f := progress * float64(len(route)-1)
	i := int(f)
	if i >= len(route)-1 {
		last := route[len(route)-1]
		return last.Lat, last.Lng, 0
	}
	frac := f - float64(i)
	a, b := route[i], route[i+1]
	lat = a.Lat + (b.Lat-a.Lat)*frac
	lng = a.Lng + (b.Lng-a.Lng)*frac
	heading = bearing(a, b)
	return
}

func bearing(a, b models.GeoPoint) float64 {
	lat1 := a.Lat * math.Pi / 180
	lat2 := b.Lat * math.Pi / 180
	dLng := (b.Lng - a.Lng) * math.Pi / 180
	y := math.Sin(dLng) * math.Cos(lat2)
	x := math.Cos(lat1)*math.Sin(lat2) - math.Sin(lat1)*math.Cos(lat2)*math.Cos(dLng)
	brng := math.Atan2(y, x) * 180 / math.Pi
	if brng < 0 {
		brng += 360
	}
	return brng
}

func HaversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
