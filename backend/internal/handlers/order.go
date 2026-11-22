package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
	"gorm.io/gorm"
)

type orderItemReq struct {
	MedicineID uint `json:"medicine_id" binding:"required"`
	Quantity   int  `json:"quantity" binding:"required,min=1"`
}

type createOrderReq struct {
	PharmacyID      uint                 `json:"pharmacy_id" binding:"required"`
	Type            models.OrderType     `json:"type"`
	PaymentMethod   models.PaymentMethod `json:"payment_method"`
	Items           []orderItemReq       `json:"items" binding:"required,min=1"`
	PrescriptionID  *uint                `json:"prescription_id"`
	DeliveryAddress string               `json:"delivery_address"`
	DeliveryArea    string               `json:"delivery_area"`
	DeliveryCity    string               `json:"delivery_city"`
	DeliveryLat     float64              `json:"delivery_lat"`
	DeliveryLng     float64              `json:"delivery_lng"`
	CustomerPhone   string               `json:"customer_phone"`
	CustomerName    string               `json:"customer_name"`
	Notes           string               `json:"notes"`
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req createOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid order payload")
		return
	}
	if req.Type == "" {
		req.Type = models.OrderDelivery
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = models.PayCOD
	}

	var pharmacy models.Pharmacy
	if err := h.DB.First(&pharmacy, req.PharmacyID).Error; err != nil {
		h.fail(c, http.StatusNotFound, "pharmacy not found")
		return
	}
	if !pharmacy.IsOpen {
		h.fail(c, http.StatusBadRequest, "pharmacy is currently closed")
		return
	}
	if req.Type == models.OrderDelivery && !pharmacy.HasDelivery {
		h.fail(c, http.StatusBadRequest, "pharmacy does not offer delivery")
		return
	}
	if req.Type == models.OrderPickup && !pharmacy.HasPickup {
		h.fail(c, http.StatusBadRequest, "pharmacy does not offer pickup")
		return
	}
	if req.Type == models.OrderDelivery && req.DeliveryAddress == "" {
		h.fail(c, http.StatusBadRequest, "delivery address is required")
		return
	}

	userID := middleware.GetUserID(c)
	var user models.User
	h.DB.First(&user, userID)

	var items []models.OrderItem
	var subtotal float64
	needsRx := false

	for _, it := range req.Items {
		var med models.Medicine
		if err := h.DB.Where("id = ? AND pharmacy_id = ?", it.MedicineID, pharmacy.ID).First(&med).Error; err != nil {
			h.fail(c, http.StatusBadRequest, fmt.Sprintf("medicine %d not found in this pharmacy", it.MedicineID))
			return
		}
		if med.Stock < it.Quantity {
			h.fail(c, http.StatusBadRequest, fmt.Sprintf("%s has insufficient stock", med.Name))
			return
		}
		applyEffectivePrice(&med)
		line := med.EffectivePrice * float64(it.Quantity)
		subtotal += line
		if med.RequiresRx {
			needsRx = true
		}
		items = append(items, models.OrderItem{
			MedicineID: med.ID,
			Name:       med.Name,
			Strength:   med.Strength,
			Quantity:   it.Quantity,
			UnitPrice:  med.EffectivePrice,
			TotalPrice: line,
			RequiresRx: med.RequiresRx,
		})
	}

	if needsRx {
		if req.PrescriptionID == nil {
			h.fail(c, http.StatusBadRequest, "prescription required for Rx medicines")
			return
		}
		var rx models.Prescription
		if err := h.DB.Where("id = ? AND user_id = ?", *req.PrescriptionID, userID).First(&rx).Error; err != nil {
			h.fail(c, http.StatusBadRequest, "prescription not found")
			return
		}
		if rx.Status == models.RxRejected {
			h.fail(c, http.StatusBadRequest, "prescription was rejected")
			return
		}
	}

	if subtotal < pharmacy.MinOrder {
		h.fail(c, http.StatusBadRequest, fmt.Sprintf("minimum order is ৳%.0f", pharmacy.MinOrder))
		return
	}

	deliveryFee := 0.0
	estimated := 15
	if req.Type == models.OrderDelivery {
		deliveryFee = pharmacy.DeliveryFee
		estimated = pharmacy.DeliveryMinutes
		if req.DeliveryLat != 0 && req.DeliveryLng != 0 {
			dist := haversineKm(req.DeliveryLat, req.DeliveryLng, pharmacy.Latitude, pharmacy.Longitude)
			if dist > 5 {
				deliveryFee += 20
				estimated += int(dist * 3)
			}
		}
	}

	customerName := req.CustomerName
	if customerName == "" {
		customerName = user.Name
	}
	customerPhone := req.CustomerPhone
	if customerPhone == "" {
		customerPhone = user.Phone
	}
	city := req.DeliveryCity
	if city == "" {
		city = "Dhaka"
	}

	subtotal = float64(int(subtotal*100+0.5)) / 100
	deliveryFee = float64(int(deliveryFee*100+0.5)) / 100
	total := float64(int((subtotal+deliveryFee)*100+0.5)) / 100

	order := models.Order{
		OrderNumber:      fmt.Sprintf("SHB%d%04d", time.Now().Unix()%1000000, userID%10000),
		UserID:           userID,
		PharmacyID:       pharmacy.ID,
		PrescriptionID:   req.PrescriptionID,
		Type:             req.Type,
		Status:           models.OrderPlaced,
		PaymentMethod:    req.PaymentMethod,
		PaymentStatus:    "pending",
		Subtotal:         subtotal,
		DeliveryFee:      deliveryFee,
		Discount:         0,
		Total:            total,
		DeliveryAddress:  req.DeliveryAddress,
		DeliveryArea:     req.DeliveryArea,
		DeliveryCity:     city,
		DeliveryLat:      req.DeliveryLat,
		DeliveryLng:      req.DeliveryLng,
		CustomerPhone:    customerPhone,
		CustomerName:     customerName,
		Notes:            req.Notes,
		EstimatedMinutes: estimated,
	}
	if req.PaymentMethod != models.PayCOD {
		order.PaymentStatus = "paid"
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].OrderID = order.ID
			if err := tx.Create(&items[i]).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.Medicine{}).Where("id = ?", items[i].MedicineID).
				UpdateColumn("stock", gorm.Expr("stock - ?", items[i].Quantity)).Error; err != nil {
				return err
			}
		}
		event := models.OrderStatusEvent{
			OrderID: order.ID,
			Status:  models.OrderPlaced,
			Note:    "Order placed successfully",
		}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}
		if req.PrescriptionID != nil {
			tx.Model(&models.Prescription{}).Where("id = ?", *req.PrescriptionID).
				Updates(map[string]interface{}{"order_id": order.ID, "pharmacy_id": pharmacy.ID, "status": models.RxVerified})
		}
		return nil
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not place order")
		return
	}

	// Simulate pharmacy confirmation shortly for demo realism via status endpoint; set confirmed here for smoother UX
	go h.progressOrderDemo(order.ID)

	h.DB.Preload("Items").Preload("Pharmacy").Preload("StatusHistory").First(&order, order.ID)
	h.created(c, order)
}

func (h *Handler) progressOrderDemo(orderID uint) {
	steps := []struct {
		after  time.Duration
		status models.OrderStatus
		note   string
		rider  bool
	}{
		{3 * time.Second, models.OrderConfirmed, "Pharmacy confirmed your order", false},
		{5 * time.Second, models.OrderPreparing, "Medicines are being prepared", false},
		{7 * time.Second, models.OrderReady, "Order is ready", false},
	}
	for _, step := range steps {
		time.Sleep(step.after)
		var order models.Order
		if err := h.DB.First(&order, orderID).Error; err != nil || order.Status == models.OrderCancelled {
			return
		}
		updates := map[string]interface{}{"status": step.status}
		startRide := false
		if step.status == models.OrderReady && order.Type == models.OrderDelivery {
			updates["status"] = models.OrderOutForDelivery
			updates["rider_name"] = "Karim Hossain"
			updates["rider_phone"] = "01711000099"
			step.status = models.OrderOutForDelivery
			step.note = "Rider picked up your medicines — live GPS tracking started"
			startRide = true
		}
		h.DB.Model(&order).Updates(updates)
		h.DB.Create(&models.OrderStatusEvent{OrderID: orderID, Status: step.status, Note: step.note})
		if startRide {
			var fresh models.Order
			h.DB.Preload("Pharmacy").First(&fresh, orderID)
			if fresh.Pharmacy != nil {
				h.Track.StartRide(&fresh, fresh.Pharmacy)
			}
		}
	}
}

func (h *Handler) ListOrders(c *gin.Context) {
	var orders []models.Order
	h.DB.Preload("Items").Preload("Pharmacy").
		Where("user_id = ?", middleware.GetUserID(c)).
		Order("id desc").Find(&orders)
	h.ok(c, orders)
}

func (h *Handler) GetOrder(c *gin.Context) {
	var order models.Order
	if err := h.DB.Preload("Items").Preload("Pharmacy").Preload("StatusHistory").
		Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).
		First(&order).Error; err != nil {
		h.fail(c, http.StatusNotFound, "order not found")
		return
	}
	h.ok(c, order)
}

func (h *Handler) CancelOrder(c *gin.Context) {
	var order models.Order
	if err := h.DB.Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).First(&order).Error; err != nil {
		h.fail(c, http.StatusNotFound, "order not found")
		return
	}
	if order.Status != models.OrderPlaced && order.Status != models.OrderConfirmed {
		h.fail(c, http.StatusBadRequest, "order can no longer be cancelled")
		return
	}
	order.Status = models.OrderCancelled
	h.DB.Save(&order)
	h.DB.Create(&models.OrderStatusEvent{OrderID: order.ID, Status: models.OrderCancelled, Note: "Cancelled by customer"})
	h.ok(c, order)
}

func (h *Handler) MarkDelivered(c *gin.Context) {
	var order models.Order
	if err := h.DB.Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).First(&order).Error; err != nil {
		h.fail(c, http.StatusNotFound, "order not found")
		return
	}
	now := time.Now()
	if order.Type == models.OrderPickup {
		order.Status = models.OrderPickedUp
	} else {
		order.Status = models.OrderDelivered
	}
	order.DeliveredAt = &now
	h.DB.Save(&order)
	h.DB.Create(&models.OrderStatusEvent{OrderID: order.ID, Status: order.Status, Note: "Order completed"})
	h.ok(c, order)
}

func (h *Handler) CreateReview(c *gin.Context) {
	var body struct {
		PharmacyID uint   `json:"pharmacy_id" binding:"required"`
		OrderID    uint   `json:"order_id" binding:"required"`
		Rating     int    `json:"rating" binding:"required,min=1,max=5"`
		Comment    string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid review")
		return
	}
	userID := middleware.GetUserID(c)
	var order models.Order
	if err := h.DB.Where("id = ? AND user_id = ?", body.OrderID, userID).First(&order).Error; err != nil {
		h.fail(c, http.StatusNotFound, "order not found")
		return
	}
	review := models.Review{
		UserID:     userID,
		PharmacyID: body.PharmacyID,
		OrderID:    body.OrderID,
		Rating:     body.Rating,
		Comment:    body.Comment,
	}
	h.DB.Create(&review)

	var avg float64
	var count int64
	h.DB.Model(&models.Review{}).Where("pharmacy_id = ?", body.PharmacyID).Count(&count)
	h.DB.Model(&models.Review{}).Where("pharmacy_id = ?", body.PharmacyID).Select("avg(rating)").Scan(&avg)
	h.DB.Model(&models.Pharmacy{}).Where("id = ?", body.PharmacyID).
		Updates(map[string]interface{}{"rating": avg, "review_count": count})

	h.created(c, review)
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "sheba-api"})
}
