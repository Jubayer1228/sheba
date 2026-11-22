package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/auth"
	"github.com/sheba/pharmacy/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type pharmacyPartnerReq struct {
	OwnerName      string  `json:"owner_name" binding:"required,min=2"`
	Email          string  `json:"email" binding:"required,email"`
	Phone          string  `json:"phone" binding:"required,min=10"`
	Password       string  `json:"password" binding:"required,min=6"`
	NIDNumber      string  `json:"nid_number" binding:"required,min=5"`
	BusinessName   string  `json:"business_name" binding:"required,min=2"`
	TradeLicense   string  `json:"trade_license" binding:"required,min=3"`
	DrugLicense    string  `json:"drug_license" binding:"required,min=3"`
	Address        string  `json:"address" binding:"required,min=5"`
	Area           string  `json:"area" binding:"required"`
	City           string  `json:"city"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	PaymentMethod  string  `json:"payment_method" binding:"required"`
	PaymentAccount string  `json:"payment_account" binding:"required,min=5"`
	Notes          string  `json:"notes"`
}

type riderPartnerReq struct {
	OwnerName      string `json:"owner_name" binding:"required,min=2"`
	Email          string `json:"email" binding:"required,email"`
	Phone          string `json:"phone" binding:"required,min=10"`
	Password       string `json:"password" binding:"required,min=6"`
	NIDNumber      string `json:"nid_number" binding:"required,min=5"`
	Area           string `json:"area" binding:"required"`
	City           string `json:"city"`
	VehicleType    string `json:"vehicle_type" binding:"required"`
	VehicleNumber  string `json:"vehicle_number" binding:"required,min=3"`
	PaymentMethod  string `json:"payment_method" binding:"required"`
	PaymentAccount string `json:"payment_account" binding:"required,min=5"`
	Notes          string `json:"notes"`
}

func (h *Handler) RegisterPharmacyPartner(c *gin.Context) {
	var req pharmacyPartnerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid pharmacy registration data")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.City == "" {
		req.City = "Dhaka"
	}

	if h.DB.Where("email = ?", req.Email).First(&models.User{}).Error == nil {
		h.fail(c, http.StatusConflict, "email already registered")
		return
	}
	if h.DB.Where("email = ? AND status = ?", req.Email, models.PartnerPending).First(&models.PartnerApplication{}).Error == nil {
		h.fail(c, http.StatusConflict, "application already pending for this email")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create application")
		return
	}

	var user models.User
	var pharmacy models.Pharmacy
	var application models.PartnerApplication

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		user = models.User{
			Name:     strings.TrimSpace(req.OwnerName),
			Email:    req.Email,
			Phone:    req.Phone,
			Password: string(hash),
			Role:     models.RolePharmacy,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}

		slug := slugify(req.BusinessName) + "-" + strings.ToLower(strings.ReplaceAll(req.Area, " ", "-"))
		lat, lng := req.Latitude, req.Longitude
		if lat == 0 && lng == 0 {
			lat, lng = 23.7461, 90.3742
		}
		pharmacy = models.Pharmacy{
			Name:            strings.TrimSpace(req.BusinessName),
			Slug:            slug,
			Description:     "Verified Sheba partner pharmacy. " + strings.TrimSpace(req.Notes),
			Phone:           req.Phone,
			Address:         req.Address,
			Area:            req.Area,
			City:            req.City,
			Latitude:        lat,
			Longitude:       lng,
			Rating:          5,
			ReviewCount:     0,
			DeliveryFee:     49,
			MinOrder:        100,
			DeliveryMinutes: 35,
			IsOpen:          true,
			AcceptsRx:       true,
			HasPickup:       true,
			HasDelivery:     true,
			Tags:            "partner,new,verified",
			OwnerID:         &user.ID,
			ImageURL:        "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80",
			CoverURL:        "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80",
		}
		if err := tx.Create(&pharmacy).Error; err != nil {
			return err
		}

		application = models.PartnerApplication{
			Type:           models.PartnerPharmacy,
			Status:         models.PartnerApproved, // demo: instant approve so partners can use the app
			OwnerName:      req.OwnerName,
			Email:          req.Email,
			Phone:          req.Phone,
			PasswordHash:   string(hash),
			NIDNumber:      req.NIDNumber,
			BusinessName:   req.BusinessName,
			TradeLicense:   req.TradeLicense,
			DrugLicense:    req.DrugLicense,
			Address:        req.Address,
			Area:           req.Area,
			City:           req.City,
			Latitude:       lat,
			Longitude:      lng,
			PaymentMethod:  req.PaymentMethod,
			PaymentAccount: req.PaymentAccount,
			Notes:          req.Notes,
			UserID:         &user.ID,
			PharmacyID:     &pharmacy.ID,
		}
		return tx.Create(&application).Error
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not register pharmacy partner")
		return
	}

	token, err := auth.GenerateToken(&user, h.JWTSecret, 30)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "account created but could not issue token")
		return
	}

	h.created(c, gin.H{
		"token":       token,
		"user":        user,
		"pharmacy":    pharmacy,
		"application": application,
		"message":     "Pharmacy partner registered and listed on Sheba",
	})
}

func (h *Handler) RegisterRiderPartner(c *gin.Context) {
	h.registerDriverPartner(c, models.PartnerRider, models.RoleRider, "Rider partner registered successfully")
}

func (h *Handler) RegisterAmbulancePartner(c *gin.Context) {
	h.registerDriverPartner(c, models.PartnerAmbulance, models.RoleAmbulance, "Ambulance driver registered successfully")
}

type doctorPartnerReq struct {
	OwnerName      string  `json:"owner_name" binding:"required,min=2"`
	Email          string  `json:"email" binding:"required,email"`
	Phone          string  `json:"phone" binding:"required,min=10"`
	Password       string  `json:"password" binding:"required,min=6"`
	NIDNumber      string  `json:"nid_number" binding:"required,min=5"`
	Specialty      string  `json:"specialty" binding:"required,min=2"`
	SpecialtyBn    string  `json:"specialty_bn"`
	BMDCNumber     string  `json:"bmdc_number" binding:"required,min=3"`
	Bio            string  `json:"bio"`
	IsFreeConsult  bool    `json:"is_free_consult"`
	ConsultFee     float64 `json:"consult_fee"`
	YearsExp       int     `json:"years_exp"`
	Area           string  `json:"area"`
	City           string  `json:"city"`
	PaymentMethod  string  `json:"payment_method"`
	PaymentAccount string  `json:"payment_account"`
	Notes          string  `json:"notes"`
}

func (h *Handler) RegisterDoctorPartner(c *gin.Context) {
	var req doctorPartnerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid doctor registration data")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.City == "" {
		req.City = "Dhaka"
	}
	if req.SpecialtyBn == "" {
		req.SpecialtyBn = req.Specialty
	}
	if !req.IsFreeConsult && req.ConsultFee <= 0 {
		req.ConsultFee = 299
	}
	if req.IsFreeConsult {
		req.ConsultFee = 0
	}
	if req.YearsExp <= 0 {
		req.YearsExp = 5
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = "bkash"
	}
	if req.PaymentAccount == "" {
		req.PaymentAccount = req.Phone
	}

	if h.DB.Where("email = ?", req.Email).First(&models.User{}).Error == nil {
		h.fail(c, http.StatusConflict, "email already registered")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create application")
		return
	}

	var user models.User
	var profile models.DoctorProfile
	var application models.PartnerApplication
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		user = models.User{
			Name:     strings.TrimSpace(req.OwnerName),
			Email:    req.Email,
			Phone:    req.Phone,
			Password: string(hash),
			Role:     models.RoleDoctor,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		profile = models.DoctorProfile{
			UserID:        user.ID,
			Specialty:     strings.TrimSpace(req.Specialty),
			SpecialtyBn:   strings.TrimSpace(req.SpecialtyBn),
			BMDCNumber:    req.BMDCNumber,
			Bio:           req.Bio,
			IsFreeConsult: req.IsFreeConsult,
			ConsultFee:    req.ConsultFee,
			YearsExp:      req.YearsExp,
			Languages:     "Bangla,English",
			IsAvailable:   true,
			Rating:        5,
		}
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}
		application = models.PartnerApplication{
			Type:           models.PartnerDoctor,
			Status:         models.PartnerApproved,
			OwnerName:      req.OwnerName,
			Email:          req.Email,
			Phone:          req.Phone,
			PasswordHash:   string(hash),
			NIDNumber:      req.NIDNumber,
			Area:           req.Area,
			City:           req.City,
			PaymentMethod:  req.PaymentMethod,
			PaymentAccount: req.PaymentAccount,
			Notes:          req.Notes,
			UserID:         &user.ID,
			Specialty:      req.Specialty,
			BMDCNumber:     req.BMDCNumber,
			IsFreeConsult:  req.IsFreeConsult,
			ConsultFee:     req.ConsultFee,
		}
		return tx.Create(&application).Error
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not register doctor")
		return
	}

	token, err := auth.GenerateToken(&user, h.JWTSecret, 30)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "account created but could not issue token")
		return
	}

	h.created(c, gin.H{
		"token":       token,
		"user":        user,
		"profile":     profile,
		"application": application,
		"message":     "Doctor registered successfully",
	})
}

func (h *Handler) registerDriverPartner(c *gin.Context, pType models.PartnerType, role models.UserRole, message string) {
	var req riderPartnerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid registration data")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.City == "" {
		req.City = "Dhaka"
	}
	if pType == models.PartnerAmbulance && req.VehicleType == "" {
		req.VehicleType = "ambulance"
	}

	if h.DB.Where("email = ?", req.Email).First(&models.User{}).Error == nil {
		h.fail(c, http.StatusConflict, "email already registered")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create application")
		return
	}

	var user models.User
	var application models.PartnerApplication
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		user = models.User{
			Name:     strings.TrimSpace(req.OwnerName),
			Email:    req.Email,
			Phone:    req.Phone,
			Password: string(hash),
			Role:     role,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		application = models.PartnerApplication{
			Type:           pType,
			Status:         models.PartnerApproved,
			OwnerName:      req.OwnerName,
			Email:          req.Email,
			Phone:          req.Phone,
			PasswordHash:   string(hash),
			NIDNumber:      req.NIDNumber,
			Area:           req.Area,
			City:           req.City,
			VehicleType:    req.VehicleType,
			VehicleNumber:  req.VehicleNumber,
			PaymentMethod:  req.PaymentMethod,
			PaymentAccount: req.PaymentAccount,
			Notes:          req.Notes,
			UserID:         &user.ID,
		}
		return tx.Create(&application).Error
	})
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not register partner")
		return
	}

	token, err := auth.GenerateToken(&user, h.JWTSecret, 30)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "account created but could not issue token")
		return
	}

	h.created(c, gin.H{
		"token":       token,
		"user":        user,
		"application": application,
		"message":     message,
	})
}

func (h *Handler) ListPartnerApplications(c *gin.Context) {
	var apps []models.PartnerApplication
	q := h.DB.Order("id desc").Limit(50)
	if t := c.Query("type"); t != "" {
		q = q.Where("type = ?", t)
	}
	q.Find(&apps)
	h.ok(c, apps)
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	repl := strings.NewReplacer(" ", "-", "&", "and", ",", "", ".", "", "'", "", "/", "-")
	out := repl.Replace(s)
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	if out == "" {
		return "partner"
	}
	return out
}
