package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/ai"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
	"gorm.io/gorm"
)

func banglaAgentLLM(h *Handler, history []ai.ChatMessage, userText string) ai.TriageResult {
	return ai.Triage(h.LLM, history, userText)
}

func (h *Handler) StartConsultation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		h.fail(c, http.StatusUnauthorized, "user not found")
		return
	}

	consult := models.Consultation{
		PatientID: userID,
		Status:    models.ConsultActive,
	}
	if err := h.DB.Create(&consult).Error; err != nil {
		h.fail(c, http.StatusInternalServerError, "could not start consultation")
		return
	}

	welcome := "Hi! I'm Sheba's health assistant. Tell me your symptoms in English — for example fever, cough, or stomach pain — and I'll help match you with a doctor."
	msg := models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           "agent",
		Content:        welcome,
		Lang:           "en",
	}
	h.DB.Create(&msg)

	h.loadConsultation(c, consult.ID)
}

func (h *Handler) ListMyConsultations(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role, _ := c.Get("user_role")
	var list []models.Consultation
	q := h.DB.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("id asc")
	}).Preload("Patient").Preload("Doctor").Order("id desc")
	if role == models.RoleDoctor {
		q = q.Where("doctor_id = ?", userID)
	} else {
		q = q.Where("patient_id = ?", userID)
	}
	q.Find(&list)
	for i := range list {
		h.attachDoctorProfile(&list[i])
	}
	h.ok(c, list)
}

func (h *Handler) DoctorInbox(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var profile models.DoctorProfile
	if err := h.DB.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		h.fail(c, http.StatusForbidden, "doctor profile required")
		return
	}

	var assigned []models.Consultation
	h.DB.Preload("Messages").Preload("Patient").
		Where("doctor_id = ? AND status IN ?", userID, []models.ConsultStatus{
			models.ConsultMatched, models.ConsultInReview, models.ConsultPrescribed,
		}).Order("id desc").Find(&assigned)

	var open []models.Consultation
	h.DB.Preload("Messages").Preload("Patient").
		Where("doctor_id IS NULL AND status = ? AND suggested_specialty = ?",
			models.ConsultMatched, profile.Specialty).
		Order("id desc").Limit(20).Find(&open)

	for i := range assigned {
		h.attachDoctorProfile(&assigned[i])
	}
	for i := range open {
		h.attachDoctorProfile(&open[i])
	}
	h.ok(c, gin.H{"assigned": assigned, "open": open, "profile": profile})
}

func (h *Handler) GetConsultation(c *gin.Context) {
	consult, err := h.findConsultForUser(c)
	if err != nil {
		h.fail(c, http.StatusNotFound, "consultation not found")
		return
	}
	h.loadConsultation(c, consult.ID)
}

func (h *Handler) PostConsultMessage(c *gin.Context) {
	consult, err := h.findConsultForUser(c)
	if err != nil {
		h.fail(c, http.StatusNotFound, "consultation not found")
		return
	}
	if consult.Status != models.ConsultActive && consult.Status != models.ConsultMatched &&
		consult.Status != models.ConsultInReview {
		h.fail(c, http.StatusBadRequest, "consultation is closed")
		return
	}

	var body struct {
		Content string `json:"content" binding:"required,min=1"`
		Lang    string `json:"lang"`
		IsVoice bool   `json:"is_voice"`
		Role    string `json:"role"` // patient | doctor (default patient for patient API)
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "message content required")
		return
	}
	if body.Lang == "" {
		body.Lang = "en"
	}

	userID := middleware.GetUserID(c)
	roleName := "patient"
	if consult.DoctorID != nil && *consult.DoctorID == userID {
		roleName = "doctor"
	} else if consult.PatientID != userID {
		h.fail(c, http.StatusForbidden, "not part of this consultation")
		return
	}

	patientMsg := models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           roleName,
		Content:        strings.TrimSpace(body.Content),
		Lang:           body.Lang,
		IsVoice:        body.IsVoice,
	}
	if err := h.DB.Create(&patientMsg).Error; err != nil {
		h.fail(c, http.StatusInternalServerError, "could not save message")
		return
	}

	// Live chat agent (LLM with rules fallback) while gathering symptoms
	if roleName == "patient" && consult.Status == models.ConsultActive {
		history := h.consultHistoryForLLM(consult.ID)
		triage := banglaAgentLLM(h, history, body.Content)
		reply := ai.PrimaryReply(triage, body.Lang)
		consult.SuggestedSpecialty = triage.Specialty
		if b, err := json.Marshal(map[string]interface{}{
			"source": triage.Source,
			"ready":  triage.Ready,
		}); err == nil {
			consult.SymptomsJSON = string(b)
		}
		if triage.PreferPaid != nil {
			consult.PreferredPaid = triage.PreferPaid
		}
		if triage.Ready {
			consult.SummaryBn = triage.SummaryBn
			if consult.SummaryBn == "" {
				consult.SummaryBn = reply
			}
			consult.SummaryEn = triage.ReplyEn
			if consult.SummaryEn == "" {
				consult.SummaryEn = reply
			}
		}
		h.DB.Save(consult)

		agentMsg := models.ConsultMessage{
			ConsultationID: consult.ID,
			Role:           "agent",
			Content:        reply,
			Lang:           body.Lang,
		}
		h.DB.Create(&agentMsg)
	}

	h.loadConsultation(c, consult.ID)
}

func (h *Handler) MatchDoctor(c *gin.Context) {
	consult, err := h.findConsultForUser(c)
	if err != nil {
		h.fail(c, http.StatusNotFound, "consultation not found")
		return
	}
	if consult.PatientID != middleware.GetUserID(c) {
		h.fail(c, http.StatusForbidden, "only patient can request match")
		return
	}
	if consult.Status != models.ConsultActive && consult.Status != models.ConsultMatched {
		h.fail(c, http.StatusBadRequest, "cannot match in current status")
		return
	}

	var body struct {
		PreferPaid *bool  `json:"prefer_paid"`
		Specialty  string `json:"specialty"`
		DoctorID   *uint  `json:"doctor_id"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.PreferPaid != nil {
		consult.PreferredPaid = body.PreferPaid
	}
	if body.Specialty != "" {
		consult.SuggestedSpecialty = body.Specialty
	}
	if consult.SuggestedSpecialty == "" {
		consult.SuggestedSpecialty = "General Physician"
	}

	var doctor models.User
	var profile models.DoctorProfile

	if body.DoctorID != nil {
		if err := h.DB.Where("user_id = ?", *body.DoctorID).First(&profile).Error; err != nil {
			h.fail(c, http.StatusNotFound, "doctor not found")
			return
		}
		h.DB.First(&doctor, profile.UserID)
	} else {
		matched, reason, err := h.pickDoctor(consult.SuggestedSpecialty, consult.PreferredPaid)
		if err != nil {
			h.fail(c, http.StatusNotFound, "no available doctor for this specialty")
			return
		}
		profile = matched
		h.DB.First(&doctor, profile.UserID)
		consult.MatchReason = reason
	}

	consult.DoctorID = &doctor.ID
	consult.Status = models.ConsultMatched
	if consult.MatchReason == "" {
		feeLabel := "paid"
		if profile.IsFreeConsult {
			feeLabel = "free"
		}
		consult.MatchReason = fmt.Sprintf("%s · %s · BMDC %s", profile.Specialty, feeLabel, profile.BMDCNumber)
	}
	h.DB.Save(consult)

	agentNote := fmt.Sprintf(
		"আপনার জন্য ডাক্তার ম্যাচ হয়েছে: %s (%s)। %s। ডাক্তার শীঘ্রই আপনার কেস দেখবেন।",
		doctor.Name,
		profile.SpecialtyBn,
		func() string {
			if profile.IsFreeConsult {
				return "এটি বিনামূল্যে পরামর্শ"
			}
			return fmt.Sprintf("পরামর্শ ফি ৳%.0f", profile.ConsultFee)
		}(),
	)
	h.DB.Create(&models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           "agent",
		Content:        agentNote,
		Lang:           "bn",
	})

	h.loadConsultation(c, consult.ID)
}

func (h *Handler) AcceptConsultation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var profile models.DoctorProfile
	if err := h.DB.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		h.fail(c, http.StatusForbidden, "doctor profile required")
		return
	}
	var consult models.Consultation
	if err := h.DB.First(&consult, c.Param("id")).Error; err != nil {
		h.fail(c, http.StatusNotFound, "consultation not found")
		return
	}
	if consult.DoctorID != nil && *consult.DoctorID != userID {
		h.fail(c, http.StatusForbidden, "not your consultation")
		return
	}
	if consult.DoctorID == nil && consult.SuggestedSpecialty != profile.Specialty {
		h.fail(c, http.StatusForbidden, "specialty mismatch")
		return
	}
	consult.DoctorID = &userID
	consult.Status = models.ConsultInReview
	h.DB.Save(&consult)
	h.DB.Create(&models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           "doctor",
		Content:        "ডাক্তার কেসটি গ্রহণ করেছেন। শীঘ্রই প্রেসক্রিপশন দেওয়া হবে।",
		Lang:           "bn",
	})
	h.loadConsultation(c, consult.ID)
}

func (h *Handler) PrescribeConsultation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var consult models.Consultation
	if err := h.DB.Preload("Patient").First(&consult, c.Param("id")).Error; err != nil {
		h.fail(c, http.StatusNotFound, "consultation not found")
		return
	}
	if consult.DoctorID == nil || *consult.DoctorID != userID {
		h.fail(c, http.StatusForbidden, "only assigned doctor can prescribe")
		return
	}

	var body struct {
		Notes string `json:"notes"`
		Items []struct {
			MedicineName string `json:"medicine_name" binding:"required"`
			GenericName  string `json:"generic_name"`
			Strength     string `json:"strength"`
			Dosage       string `json:"dosage"`
			Duration     string `json:"duration"`
			Quantity     int    `json:"quantity"`
			Instructions string `json:"instructions"`
		} `json:"items" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "at least one medicine item required")
		return
	}

	var doctor models.User
	h.DB.First(&doctor, userID)
	patientName := ""
	if consult.Patient != nil {
		patientName = consult.Patient.Name
	}

	var rx models.Prescription
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		rx = models.Prescription{
			UserID:         consult.PatientID,
			FileURL:        "",
			FileName:       "doctor-prescription.json",
			Notes:          body.Notes,
			PatientName:    patientName,
			DoctorName:     doctor.Name,
			Status:         models.RxVerified,
			Source:         "doctor",
			ConsultationID: &consult.ID,
			DoctorUserID:   &userID,
		}
		if err := tx.Create(&rx).Error; err != nil {
			return err
		}
		for _, it := range body.Items {
			qty := it.Quantity
			if qty < 1 {
				qty = 1
			}
			item := models.PrescriptionItem{
				PrescriptionID: rx.ID,
				MedicineName:   it.MedicineName,
				GenericName:    it.GenericName,
				Strength:       it.Strength,
				Dosage:         it.Dosage,
				Duration:       it.Duration,
				Quantity:       qty,
				Instructions:   it.Instructions,
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
		}
		consult.PrescriptionID = &rx.ID
		consult.Status = models.ConsultPrescribed
		consult.SummaryBn = strings.TrimSpace(consult.SummaryBn + "\n" + body.Notes)
		return tx.Save(&consult).Error
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create prescription")
		return
	}

	h.DB.Create(&models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           "doctor",
		Content:        "প্রেসক্রিপশন তৈরি হয়েছে। আপনি এখন ফার্মেসি থেকে অর্ডার করতে পারেন।",
		Lang:           "bn",
	})

	h.DB.Preload("Items").First(&rx, rx.ID)
	h.loadConsultation(c, consult.ID)
}

func (h *Handler) OrderFromPrescription(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var rx models.Prescription
	if err := h.DB.Preload("Items").Where("id = ? AND user_id = ?", c.Param("id"), userID).First(&rx).Error; err != nil {
		h.fail(c, http.StatusNotFound, "prescription not found")
		return
	}
	if len(rx.Items) == 0 {
		h.fail(c, http.StatusBadRequest, "prescription has no structured items")
		return
	}

	var body struct {
		PharmacyID      uint                 `json:"pharmacy_id" binding:"required"`
		Type            models.OrderType     `json:"type"`
		PaymentMethod   models.PaymentMethod `json:"payment_method"`
		DeliveryAddress string               `json:"delivery_address"`
		DeliveryArea    string               `json:"delivery_area"`
		DeliveryCity    string               `json:"delivery_city"`
		DeliveryLat     float64              `json:"delivery_lat"`
		DeliveryLng     float64              `json:"delivery_lng"`
		CustomerPhone   string               `json:"customer_phone"`
		CustomerName    string               `json:"customer_name"`
		Notes           string               `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "pharmacy_id required")
		return
	}
	if body.Type == "" {
		body.Type = models.OrderDelivery
	}
	if body.PaymentMethod == "" {
		body.PaymentMethod = models.PayCOD
	}

	var pharmacy models.Pharmacy
	if err := h.DB.First(&pharmacy, body.PharmacyID).Error; err != nil {
		h.fail(c, http.StatusNotFound, "pharmacy not found")
		return
	}
	if body.Type == models.OrderDelivery && body.DeliveryAddress == "" {
		h.fail(c, http.StatusBadRequest, "delivery address is required")
		return
	}

	var user models.User
	h.DB.First(&user, userID)

	var items []models.OrderItem
	var subtotal float64
	missing := []string{}

	for _, pi := range rx.Items {
		var med models.Medicine
		q := h.DB.Where("pharmacy_id = ?", pharmacy.ID)
		name := strings.TrimSpace(pi.MedicineName)
		generic := strings.TrimSpace(pi.GenericName)
		if generic != "" {
			q = q.Where("LOWER(name) LIKE ? OR LOWER(generic_name) LIKE ?",
				"%"+strings.ToLower(name)+"%", "%"+strings.ToLower(generic)+"%")
		} else {
			q = q.Where("LOWER(name) LIKE ? OR LOWER(generic_name) LIKE ?",
				"%"+strings.ToLower(name)+"%", "%"+strings.ToLower(name)+"%")
		}
		if err := q.First(&med).Error; err != nil {
			missing = append(missing, name)
			continue
		}
		qty := pi.Quantity
		if qty < 1 {
			qty = 1
		}
		applyEffectivePrice(&med)
		line := med.EffectivePrice * float64(qty)
		subtotal += line
		items = append(items, models.OrderItem{
			MedicineID: med.ID,
			Name:       med.Name,
			Strength:   med.Strength,
			Quantity:   qty,
			UnitPrice:  med.EffectivePrice,
			TotalPrice: line,
			RequiresRx: med.RequiresRx,
		})
	}

	if len(items) == 0 {
		h.fail(c, http.StatusBadRequest, "no matching medicines at this pharmacy: "+strings.Join(missing, ", "))
		return
	}

	deliveryFee := 0.0
	if body.Type == models.OrderDelivery {
		deliveryFee = pharmacy.DeliveryFee
	}
	if subtotal < pharmacy.MinOrder && body.Type == models.OrderDelivery {
		h.fail(c, http.StatusBadRequest, fmt.Sprintf("minimum order is ৳%.0f", pharmacy.MinOrder))
		return
	}

	customerName := body.CustomerName
	if customerName == "" {
		customerName = user.Name
	}
	customerPhone := body.CustomerPhone
	if customerPhone == "" {
		customerPhone = user.Phone
	}
	city := body.DeliveryCity
	if city == "" {
		city = "Dhaka"
	}

	var order models.Order
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		order = models.Order{
			OrderNumber:      fmt.Sprintf("SHB-%d", time.Now().UnixNano()%1_000_000_000),
			UserID:           userID,
			PharmacyID:       pharmacy.ID,
			PrescriptionID:   &rx.ID,
			Type:             body.Type,
			Status:           models.OrderPlaced,
			PaymentMethod:    body.PaymentMethod,
			PaymentStatus:    "pending",
			Subtotal:         round2(subtotal),
			DeliveryFee:      deliveryFee,
			Total:            round2(subtotal + deliveryFee),
			DeliveryAddress:  body.DeliveryAddress,
			DeliveryArea:     body.DeliveryArea,
			DeliveryCity:     city,
			DeliveryLat:      body.DeliveryLat,
			DeliveryLng:      body.DeliveryLng,
			CustomerPhone:    customerPhone,
			CustomerName:     customerName,
			Notes:            body.Notes,
			EstimatedMinutes: pharmacy.DeliveryMinutes,
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].OrderID = order.ID
			if err := tx.Create(&items[i]).Error; err != nil {
				return err
			}
			tx.Model(&models.Medicine{}).Where("id = ?", items[i].MedicineID).
				UpdateColumn("stock", gorm.Expr("stock - ?", items[i].Quantity))
		}
		tx.Create(&models.OrderStatusEvent{
			OrderID: order.ID,
			Status:  models.OrderPlaced,
			Note:    "Ordered from doctor prescription",
		})
		rx.OrderID = &order.ID
		rx.PharmacyID = &pharmacy.ID
		rx.Status = models.RxFulfilled
		if err := tx.Save(&rx).Error; err != nil {
			return err
		}
		if rx.ConsultationID != nil {
			tx.Model(&models.Consultation{}).Where("id = ?", *rx.ConsultationID).
				Update("status", models.ConsultCompleted)
		}
		return nil
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create order")
		return
	}

	h.DB.Preload("Items").Preload("Pharmacy").Preload("StatusHistory").First(&order, order.ID)
	resp := gin.H{"order": order}
	if len(missing) > 0 {
		resp["missing_medicines"] = missing
	}
	h.created(c, resp)
}

func (h *Handler) ListDoctors(c *gin.Context) {
	q := h.DB.Preload("User").Where("is_available = ?", true)
	if s := c.Query("specialty"); s != "" {
		q = q.Where("specialty = ? OR specialty_bn LIKE ?", s, "%"+s+"%")
	}
	if c.Query("free") == "1" {
		q = q.Where("is_free_consult = ?", true)
	}
	if c.Query("paid") == "1" {
		q = q.Where("is_free_consult = ?", false)
	}
	var list []models.DoctorProfile
	q.Order("is_free_consult desc, rating desc, id asc").Find(&list)
	h.ok(c, list)
}

func (h *Handler) GetMyDoctorProfile(c *gin.Context) {
	var profile models.DoctorProfile
	if err := h.DB.Preload("User").Where("user_id = ?", middleware.GetUserID(c)).First(&profile).Error; err != nil {
		h.fail(c, http.StatusNotFound, "doctor profile not found")
		return
	}
	h.ok(c, profile)
}

// --- helpers ---

func (h *Handler) findConsultForUser(c *gin.Context) (*models.Consultation, error) {
	userID := middleware.GetUserID(c)
	var consult models.Consultation
	if err := h.DB.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("id asc")
	}).Preload("Patient").Preload("Doctor").First(&consult, c.Param("id")).Error; err != nil {
		return nil, err
	}
	if consult.PatientID != userID && (consult.DoctorID == nil || *consult.DoctorID != userID) {
		role, _ := c.Get("user_role")
		if role != models.RoleDoctor {
			return nil, gorm.ErrRecordNotFound
		}
	}
	return &consult, nil
}

func (h *Handler) loadConsultation(c *gin.Context, id uint) {
	var consult models.Consultation
	h.DB.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("id asc")
	}).Preload("Patient").Preload("Doctor").First(&consult, id)
	h.attachDoctorProfile(&consult)
	payload := gin.H{"consultation": consult}
	if consult.PrescriptionID != nil {
		var rx models.Prescription
		h.DB.Preload("Items").First(&rx, *consult.PrescriptionID)
		payload["prescription"] = rx
	}
	h.ok(c, payload)
}

func (h *Handler) attachDoctorProfile(consult *models.Consultation) {
	if consult.DoctorID == nil {
		return
	}
	var p models.DoctorProfile
	if err := h.DB.Preload("User").Where("user_id = ?", *consult.DoctorID).First(&p).Error; err == nil {
		consult.DoctorProfile = &p
	}
}

func (h *Handler) pickDoctor(specialty string, preferPaid *bool) (models.DoctorProfile, string, error) {
	var profiles []models.DoctorProfile
	h.DB.Where("is_available = ? AND specialty = ?", true, specialty).
		Order("rating desc").Find(&profiles)
	if len(profiles) == 0 {
		h.DB.Where("is_available = ? AND specialty = ?", true, "General Physician").
			Order("rating desc").Find(&profiles)
		specialty = "General Physician"
	}
	if len(profiles) == 0 {
		return models.DoctorProfile{}, "", gorm.ErrRecordNotFound
	}

	preferFree := preferPaid == nil || !*preferPaid
	if preferPaid != nil && *preferPaid {
		preferFree = false
	}

	var free, paid []models.DoctorProfile
	for _, p := range profiles {
		if p.IsFreeConsult {
			free = append(free, p)
		} else {
			paid = append(paid, p)
		}
	}

	if preferFree && len(free) > 0 {
		return free[0], "Matched free " + specialty, nil
	}
	if !preferFree && len(paid) > 0 {
		return paid[0], "Matched paid " + specialty, nil
	}
	if len(free) > 0 {
		return free[0], "Fallback free " + specialty, nil
	}
	return paid[0], "Fallback paid " + specialty, nil
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
