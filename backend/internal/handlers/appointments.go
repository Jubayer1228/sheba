package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
	"gorm.io/gorm"
)

func (h *Handler) ListDoctorSlots(c *gin.Context) {
	doctorID := c.Param("id")
	day := c.Query("date")
	q := h.DB.Where("doctor_id = ? AND is_booked = ? AND starts_at > ?", doctorID, false, time.Now().Add(-5*time.Minute))
	if day != "" {
		start, err := time.ParseInLocation("2006-01-02", day, time.Local)
		if err == nil {
			q = q.Where("starts_at >= ? AND starts_at < ?", start, start.Add(24*time.Hour))
		}
	}
	var slots []models.DoctorSlot
	q.Order("starts_at asc").Limit(40).Find(&slots)
	h.ok(c, slots)
}

func (h *Handler) GetDoctor(c *gin.Context) {
	var profile models.DoctorProfile
	// accept profile id OR user id
	if err := h.DB.Preload("User").Where("id = ? OR user_id = ?", c.Param("id"), c.Param("id")).First(&profile).Error; err != nil {
		h.fail(c, http.StatusNotFound, "doctor not found")
		return
	}
	var upcoming int64
	h.DB.Model(&models.DoctorSlot{}).Where("doctor_id = ? AND is_booked = ? AND starts_at > ?", profile.UserID, false, time.Now()).Count(&upcoming)
	h.ok(c, gin.H{"profile": profile, "open_slots": upcoming})
}

type bookApptReq struct {
	DoctorID       uint                   `json:"doctor_id" binding:"required"` // user id
	SlotID         *uint                  `json:"slot_id"`
	ScheduledAt    string                 `json:"scheduled_at"`
	Mode           models.AppointmentMode `json:"mode"`
	Reason         string                 `json:"reason"`
	ReasonBn       string                 `json:"reason_bn"`
	ConsultationID *uint                  `json:"consultation_id"`
	Instant        bool                   `json:"instant"`
}

func (h *Handler) BookAppointment(c *gin.Context) {
	var req bookApptReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid booking payload")
		return
	}
	if req.Mode == "" {
		req.Mode = models.ModeVideo
	}
	patientID := middleware.GetUserID(c)

	var profile models.DoctorProfile
	if err := h.DB.Preload("User").Where("user_id = ?", req.DoctorID).First(&profile).Error; err != nil {
		h.fail(c, http.StatusNotFound, "doctor not found")
		return
	}

	var slot *models.DoctorSlot
	var starts, ends time.Time
	if req.Instant {
		starts = time.Now()
		ends = starts.Add(20 * time.Minute)
	} else if req.SlotID != nil {
		var s models.DoctorSlot
		if err := h.DB.Where("id = ? AND doctor_id = ? AND is_booked = ?", *req.SlotID, req.DoctorID, false).First(&s).Error; err != nil {
			h.fail(c, http.StatusBadRequest, "slot unavailable")
			return
		}
		slot = &s
		starts, ends = s.StartsAt, s.EndsAt
	} else if req.ScheduledAt != "" {
		t, err := time.Parse(time.RFC3339, req.ScheduledAt)
		if err != nil {
			h.fail(c, http.StatusBadRequest, "scheduled_at must be RFC3339")
			return
		}
		starts = t
		ends = t.Add(20 * time.Minute)
	} else {
		h.fail(c, http.StatusBadRequest, "slot_id, scheduled_at, or instant required")
		return
	}

	status := models.ApptScheduled
	if req.Instant || starts.Before(time.Now().Add(15*time.Minute)) {
		status = models.ApptReady
	}

	var appt models.Appointment
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var slotID *uint
		if slot != nil {
			if err := tx.Model(slot).Update("is_booked", true).Error; err != nil {
				return err
			}
			sid := slot.ID
			slotID = &sid
		}
		appt = models.Appointment{
			PatientID:      patientID,
			DoctorID:       req.DoctorID,
			SlotID:         slotID,
			ConsultationID: req.ConsultationID,
			Mode:           req.Mode,
			Status:         status,
			ScheduledAt:    starts,
			EndsAt:         ends,
			Reason:         strings.TrimSpace(req.Reason),
			ReasonBn:       strings.TrimSpace(req.ReasonBn),
			Fee:            profile.ConsultFee,
			IsFree:         profile.IsFreeConsult,
			IsInstant:      req.Instant,
		}
		return tx.Create(&appt).Error
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not book appointment")
		return
	}

	h.enrichAppointment(&appt)
	h.created(c, appt)
}

func (h *Handler) ListAppointments(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role, _ := c.Get("user_role")
	q := h.DB.Preload("Patient").Preload("Doctor").Preload("CallSession").Order("scheduled_at desc")
	if role == models.RoleDoctor {
		q = q.Where("doctor_id = ?", userID)
	} else {
		q = q.Where("patient_id = ?", userID)
	}
	if st := c.Query("status"); st != "" {
		q = q.Where("status = ?", st)
	}
	var list []models.Appointment
	q.Limit(50).Find(&list)
	for i := range list {
		h.enrichAppointment(&list[i])
	}
	h.ok(c, list)
}

func (h *Handler) GetAppointment(c *gin.Context) {
	appt, err := h.findAppointmentForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "appointment not found")
		return
	}
	h.enrichAppointment(appt)
	h.ok(c, appt)
}

func (h *Handler) CancelAppointment(c *gin.Context) {
	appt, err := h.findAppointmentForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "appointment not found")
		return
	}
	if appt.Status == models.ApptInCall || appt.Status == models.ApptCompleted {
		h.fail(c, http.StatusBadRequest, "cannot cancel active/completed appointment")
		return
	}
	appt.Status = models.ApptCancelled
	h.DB.Save(appt)
	if appt.SlotID != nil {
		h.DB.Model(&models.DoctorSlot{}).Where("id = ?", *appt.SlotID).Update("is_booked", false)
	}
	h.ok(c, appt)
}

func (h *Handler) StartCall(c *gin.Context) {
	appt, err := h.findAppointmentForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "appointment not found")
		return
	}
	if appt.Status == models.ApptCancelled || appt.Status == models.ApptCompleted {
		h.fail(c, http.StatusBadRequest, "appointment not callable")
		return
	}
	userID := middleware.GetUserID(c)
	now := time.Now()

	var session models.CallSession
	if appt.CallSessionID != nil {
		h.DB.First(&session, *appt.CallSessionID)
		if session.Status == models.CallActive || session.Status == models.CallRinging {
			h.enrichAppointment(appt)
			h.ok(c, gin.H{"appointment": appt, "call": session})
			return
		}
	}

	session = models.CallSession{
		AppointmentID: appt.ID,
		PatientID:     appt.PatientID,
		DoctorID:      appt.DoctorID,
		Mode:          appt.Mode,
		Status:        models.CallRinging,
		StartedBy:     userID,
		StartedAt:     &now,
	}
	if err := h.DB.Create(&session).Error; err != nil {
		h.fail(c, http.StatusInternalServerError, "could not start call")
		return
	}
	appt.CallSessionID = &session.ID
	appt.Status = models.ApptRinging
	h.DB.Save(appt)

	h.DB.Preload("Patient").Preload("Doctor").First(&session, session.ID)
	h.enrichAppointment(appt)
	h.created(c, gin.H{"appointment": appt, "call": session})
}

func (h *Handler) AnswerCall(c *gin.Context) {
	session, err := h.findCallForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "call not found")
		return
	}
	userID := middleware.GetUserID(c)
	if userID != session.DoctorID && userID != session.PatientID {
		h.fail(c, http.StatusForbidden, "not a call participant")
		return
	}
	now := time.Now()
	session.Status = models.CallActive
	session.AnsweredAt = &now
	h.DB.Save(session)
	h.DB.Model(&models.Appointment{}).Where("id = ?", session.AppointmentID).
		Updates(map[string]interface{}{"status": models.ApptInCall})
	h.DB.Preload("Patient").Preload("Doctor").First(session, session.ID)
	h.ok(c, session)
}

func (h *Handler) EndCall(c *gin.Context) {
	session, err := h.findCallForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "call not found")
		return
	}
	now := time.Now()
	session.Status = models.CallEnded
	session.EndedAt = &now
	h.DB.Save(session)
	h.DB.Model(&models.Appointment{}).Where("id = ?", session.AppointmentID).
		Updates(map[string]interface{}{"status": models.ApptCompleted})
	h.DB.Create(&models.CallSignal{
		CallSessionID: session.ID,
		FromUserID:    middleware.GetUserID(c),
		Kind:          "hangup",
		Payload:       `{"reason":"ended"}`,
	})
	h.ok(c, session)
}

func (h *Handler) GetCall(c *gin.Context) {
	session, err := h.findCallForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "call not found")
		return
	}
	h.DB.Preload("Patient").Preload("Doctor").First(session, session.ID)
	var appt models.Appointment
	h.DB.First(&appt, session.AppointmentID)
	h.ok(c, gin.H{"call": session, "appointment": appt})
}

func (h *Handler) PostCallSignal(c *gin.Context) {
	session, err := h.findCallForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "call not found")
		return
	}
	var body struct {
		Kind    string `json:"kind" binding:"required"`
		Payload string `json:"payload" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "kind and payload required")
		return
	}
	sig := models.CallSignal{
		CallSessionID: session.ID,
		FromUserID:    middleware.GetUserID(c),
		Kind:          body.Kind,
		Payload:       body.Payload,
	}
	h.DB.Create(&sig)
	h.created(c, sig)
}

func (h *Handler) ListCallSignals(c *gin.Context) {
	session, err := h.findCallForUser(c, c.Param("id"))
	if err != nil {
		h.fail(c, http.StatusNotFound, "call not found")
		return
	}
	afterID := c.Query("after_id")
	q := h.DB.Where("call_session_id = ? AND from_user_id != ?", session.ID, middleware.GetUserID(c))
	if afterID != "" {
		q = q.Where("id > ?", afterID)
	}
	var sigs []models.CallSignal
	q.Order("id asc").Limit(100).Find(&sigs)
	h.ok(c, sigs)
}

func (h *Handler) DoctorIncomingCalls(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var calls []models.CallSession
	h.DB.Preload("Patient").Preload("Doctor").
		Where("doctor_id = ? AND status IN ?", userID, []models.CallStatus{models.CallRinging, models.CallActive}).
		Order("id desc").Limit(10).Find(&calls)

	var ringingAppts []models.Appointment
	h.DB.Preload("Patient").Preload("CallSession").
		Where("doctor_id = ? AND status IN ?", userID, []models.AppointmentStatus{models.ApptRinging, models.ApptReady, models.ApptInCall}).
		Order("scheduled_at asc").Limit(20).Find(&ringingAppts)
	for i := range ringingAppts {
		h.enrichAppointment(&ringingAppts[i])
	}
	h.ok(c, gin.H{"calls": calls, "appointments": ringingAppts})
}

func (h *Handler) findAppointmentForUser(c *gin.Context, id string) (*models.Appointment, error) {
	userID := middleware.GetUserID(c)
	var appt models.Appointment
	if err := h.DB.Preload("Patient").Preload("Doctor").Preload("CallSession").First(&appt, id).Error; err != nil {
		return nil, err
	}
	if appt.PatientID != userID && appt.DoctorID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	return &appt, nil
}

func (h *Handler) findCallForUser(c *gin.Context, id string) (*models.CallSession, error) {
	userID := middleware.GetUserID(c)
	var session models.CallSession
	if err := h.DB.First(&session, id).Error; err != nil {
		return nil, err
	}
	if session.PatientID != userID && session.DoctorID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	return &session, nil
}

func (h *Handler) enrichAppointment(a *models.Appointment) {
	var p models.DoctorProfile
	if err := h.DB.Preload("User").Where("user_id = ?", a.DoctorID).First(&p).Error; err == nil {
		a.DoctorProfile = &p
	}
}
