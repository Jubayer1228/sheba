package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
)

func (h *Handler) UploadPrescription(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		h.fail(c, http.StatusBadRequest, "prescription file is required")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".pdf": true, ".webp": true}
	if !allowed[ext] {
		h.fail(c, http.StatusBadRequest, "only jpg, png, webp, or pdf allowed")
		return
	}
	if file.Size > 8<<20 {
		h.fail(c, http.StatusBadRequest, "file must be under 8MB")
		return
	}

	_ = os.MkdirAll(h.UploadDir, 0o755)
	filename := fmt.Sprintf("rx_%d_%d%s", middleware.GetUserID(c), time.Now().UnixNano(), ext)
	dest := filepath.Join(h.UploadDir, filename)
	if err := c.SaveUploadedFile(file, dest); err != nil {
		h.fail(c, http.StatusInternalServerError, "could not save file")
		return
	}

	var pharmacyID *uint
	if pid := c.PostForm("pharmacy_id"); pid != "" {
		var p models.Pharmacy
		if err := h.DB.First(&p, pid).Error; err == nil {
			pharmacyID = &p.ID
		}
	}

	rx := models.Prescription{
		UserID:      middleware.GetUserID(c),
		PharmacyID:  pharmacyID,
		FileURL:     "/uploads/" + filename,
		FileName:    file.Filename,
		Notes:       c.PostForm("notes"),
		PatientName: c.PostForm("patient_name"),
		DoctorName:  c.PostForm("doctor_name"),
		Status:      models.RxPending,
	}
	if err := h.DB.Create(&rx).Error; err != nil {
		h.fail(c, http.StatusInternalServerError, "could not save prescription")
		return
	}

	h.DB.Preload("Pharmacy").First(&rx, rx.ID)
	h.created(c, rx)
}

func (h *Handler) ListPrescriptions(c *gin.Context) {
	var list []models.Prescription
	h.DB.Preload("Pharmacy").Preload("Items").Where("user_id = ?", middleware.GetUserID(c)).
		Order("id desc").Find(&list)
	h.ok(c, list)
}

func (h *Handler) GetPrescription(c *gin.Context) {
	var rx models.Prescription
	if err := h.DB.Preload("Pharmacy").Preload("Items").Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).
		First(&rx).Error; err != nil {
		h.fail(c, http.StatusNotFound, "prescription not found")
		return
	}
	h.ok(c, rx)
}

func (h *Handler) AssignPrescriptionPharmacy(c *gin.Context) {
	var body struct {
		PharmacyID uint `json:"pharmacy_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "pharmacy_id required")
		return
	}
	var rx models.Prescription
	if err := h.DB.Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUserID(c)).First(&rx).Error; err != nil {
		h.fail(c, http.StatusNotFound, "prescription not found")
		return
	}
	var pharmacy models.Pharmacy
	if err := h.DB.First(&pharmacy, body.PharmacyID).Error; err != nil {
		h.fail(c, http.StatusNotFound, "pharmacy not found")
		return
	}
	if !pharmacy.AcceptsRx {
		h.fail(c, http.StatusBadRequest, "pharmacy does not accept prescriptions")
		return
	}
	rx.PharmacyID = &pharmacy.ID
	h.DB.Save(&rx)
	h.DB.Preload("Pharmacy").First(&rx, rx.ID)
	h.ok(c, rx)
}
