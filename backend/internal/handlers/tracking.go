package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
	"github.com/sheba/pharmacy/internal/tracking"
)

func (h *Handler) buildTrackingPayload(order *models.Order, ride *tracking.RideState, tick bool) models.LiveTracking {
	var pharmacy models.Pharmacy
	if order.Pharmacy != nil {
		pharmacy = *order.Pharmacy
	} else {
		h.DB.First(&pharmacy, order.PharmacyID)
	}

	payload := models.LiveTracking{
		OrderID:            order.ID,
		OrderNumber:        order.OrderNumber,
		Status:             order.Status,
		Type:               order.Type,
		RiderName:          order.RiderName,
		RiderPhone:         order.RiderPhone,
		PharmacyName:       pharmacy.Name,
		PharmacyLat:        pharmacy.Latitude,
		PharmacyLng:        pharmacy.Longitude,
		DestinationAddress: order.DeliveryAddress,
		DestinationLat:     order.DeliveryLat,
		DestinationLng:     order.DeliveryLng,
		AreaLabel:          order.DeliveryArea,
	}
	if payload.DestinationLat == 0 && payload.DestinationLng == 0 {
		payload.DestinationLat = pharmacy.Latitude + 0.008
		payload.DestinationLng = pharmacy.Longitude - 0.006
	}

	if ride != nil {
		activeRide := ride
		if tick {
			if updated, ok := h.Track.Tick(order.ID); ok {
				activeRide = updated
			} else if snap, ok := h.Track.Snapshot(order.ID); ok {
				activeRide = snap
			}
		}
		payload.RiderLat = activeRide.Lat
		payload.RiderLng = activeRide.Lng
		payload.RiderHeading = activeRide.Heading
		payload.RiderSpeedKmh = activeRide.SpeedKmh
		t := activeRide.UpdatedAt
		payload.RiderUpdatedAt = &t
		payload.Route = activeRide.Route
		payload.Progress = activeRide.Progress
		payload.IsLive = activeRide.Active && order.Status == models.OrderOutForDelivery
		payload.DistanceRemainingKm = tracking.HaversineKm(activeRide.Lat, activeRide.Lng, activeRide.DestLat, activeRide.DestLng)
		if activeRide.SpeedKmh > 1 {
			payload.EtaMinutes = int(payload.DistanceRemainingKm / activeRide.SpeedKmh * 60)
			if payload.EtaMinutes < 1 && activeRide.Active {
				payload.EtaMinutes = 1
			}
		} else if activeRide.Active {
			payload.EtaMinutes = 1
		}
		if activeRide.RiderName != "" {
			payload.RiderName = activeRide.RiderName
		}
		if activeRide.RiderPhone != "" {
			payload.RiderPhone = activeRide.RiderPhone
		}

		h.DB.Model(order).Updates(map[string]interface{}{
			"rider_lat":         activeRide.Lat,
			"rider_lng":         activeRide.Lng,
			"rider_heading":     activeRide.Heading,
			"rider_speed_kmh":   activeRide.SpeedKmh,
			"rider_updated_at":  activeRide.UpdatedAt,
		})

		if !activeRide.Active && activeRide.Progress >= 1 && order.Status == models.OrderOutForDelivery {
			now := time.Now()
			h.DB.Model(order).Updates(map[string]interface{}{
				"status":          models.OrderDelivered,
				"delivered_at":    now,
				"rider_speed_kmh": 0,
			})
			h.DB.Create(&models.OrderStatusEvent{
				OrderID: order.ID,
				Status:  models.OrderDelivered,
				Note:    "Rider arrived — order delivered",
			})
			payload.Status = models.OrderDelivered
			payload.IsLive = false
			payload.EtaMinutes = 0
			payload.DistanceRemainingKm = 0
			payload.Progress = 1
		}
	} else if order.RiderLat != 0 || order.RiderLng != 0 {
		payload.RiderLat = order.RiderLat
		payload.RiderLng = order.RiderLng
		payload.RiderHeading = order.RiderHeading
		payload.RiderSpeedKmh = order.RiderSpeedKmh
		payload.RiderUpdatedAt = order.RiderUpdatedAt
		payload.Route = []models.GeoPoint{
			{Lat: pharmacy.Latitude, Lng: pharmacy.Longitude},
			{Lat: order.RiderLat, Lng: order.RiderLng},
			{Lat: payload.DestinationLat, Lng: payload.DestinationLng},
		}
		payload.IsLive = order.Status == models.OrderOutForDelivery
	} else {
		payload.RiderLat = pharmacy.Latitude
		payload.RiderLng = pharmacy.Longitude
		payload.Route = []models.GeoPoint{
			{Lat: pharmacy.Latitude, Lng: pharmacy.Longitude},
			{Lat: payload.DestinationLat, Lng: payload.DestinationLng},
		}
		payload.IsLive = false
		if order.EstimatedMinutes > 0 {
			payload.EtaMinutes = order.EstimatedMinutes
		}
	}

	return payload
}

func (h *Handler) ensureRide(order *models.Order) *tracking.RideState {
	if order.Type != models.OrderDelivery {
		return nil
	}
	if ride, ok := h.Track.Snapshot(order.ID); ok {
		return ride
	}
	if order.Status == models.OrderOutForDelivery && order.Pharmacy != nil {
		if order.RiderName == "" {
			order.RiderName = "Karim Hossain"
			order.RiderPhone = "01711000099"
			h.DB.Model(order).Updates(map[string]interface{}{
				"rider_name":  order.RiderName,
				"rider_phone": order.RiderPhone,
			})
		}
		h.Track.StartRide(order, order.Pharmacy)
		ride, _ := h.Track.Snapshot(order.ID)
		return ride
	}
	return nil
}

func (h *Handler) GetOrderTracking(c *gin.Context) {
	var order models.Order
	if err := h.DB.Preload("Pharmacy").
		Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).
		First(&order).Error; err != nil {
		h.fail(c, http.StatusNotFound, "order not found")
		return
	}
	if order.Type != models.OrderDelivery {
		h.fail(c, http.StatusBadRequest, "live GPS tracking is for delivery orders")
		return
	}

	ride := h.ensureRide(&order)
	payload := h.buildTrackingPayload(&order, ride, order.Status == models.OrderOutForDelivery)
	h.ok(c, payload)
}

// LiveOrderTracking streams GPS updates every second (SSE).
func (h *Handler) LiveOrderTracking(c *gin.Context) {
	var order models.Order
	if err := h.DB.Preload("Pharmacy").
		Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).
		First(&order).Error; err != nil {
		h.fail(c, http.StatusNotFound, "order not found")
		return
	}
	if order.Type != models.OrderDelivery {
		h.fail(c, http.StatusBadRequest, "live GPS tracking is for delivery orders")
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		h.fail(c, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	write := func() bool {
		var fresh models.Order
		if err := h.DB.Preload("Pharmacy").First(&fresh, order.ID).Error; err != nil {
			return false
		}
		ride := h.ensureRide(&fresh)
		payload := h.buildTrackingPayload(&fresh, ride, fresh.Status == models.OrderOutForDelivery)
		b, _ := json.Marshal(gin.H{"data": payload})
		if _, err := fmt.Fprintf(c.Writer, "event: tracking\ndata: %s\n\n", b); err != nil {
			return false
		}
		flusher.Flush()
		if payload.Status == models.OrderDelivered || payload.Status == models.OrderCancelled {
			return false
		}
		return true
	}

	if !write() {
		return
	}

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			if !write() {
				return
			}
		}
	}
}
