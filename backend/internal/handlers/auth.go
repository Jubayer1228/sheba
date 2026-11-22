package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/auth"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type registerReq struct {
	Name     string `json:"name" binding:"required,min=2"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone" binding:"required,min=10"`
	Password string `json:"password" binding:"required,min=6"`
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type updateProfileReq struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type addressReq struct {
	Label      string  `json:"label"`
	Line1      string  `json:"line1" binding:"required"`
	Area       string  `json:"area"`
	City       string  `json:"city"`
	PostalCode string  `json:"postal_code"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	IsDefault  bool    `json:"is_default"`
}

func (h *Handler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid registration data")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var existing models.User
	if err := h.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		h.fail(c, http.StatusConflict, "email already registered")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create account")
		return
	}

	user := models.User{
		Name:     strings.TrimSpace(req.Name),
		Email:    req.Email,
		Phone:    req.Phone,
		Password: string(hash),
		Role:     models.RoleCustomer,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		h.fail(c, http.StatusInternalServerError, "could not create account")
		return
	}

	token, err := auth.GenerateToken(&user, h.JWTSecret, 30)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not issue token")
		return
	}

	h.created(c, gin.H{"token": token, "user": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid login data")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		h.fail(c, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		h.fail(c, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := auth.GenerateToken(&user, h.JWTSecret, 30)
	if err != nil {
		h.fail(c, http.StatusInternalServerError, "could not issue token")
		return
	}

	h.ok(c, gin.H{"token": token, "user": user})
}

func (h *Handler) Me(c *gin.Context) {
	var user models.User
	if err := h.DB.Preload("Addresses").First(&user, middleware.GetUserID(c)).Error; err != nil {
		h.fail(c, http.StatusNotFound, "user not found")
		return
	}
	h.ok(c, user)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	var req updateProfileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid profile data")
		return
	}
	var user models.User
	if err := h.DB.First(&user, middleware.GetUserID(c)).Error; err != nil {
		h.fail(c, http.StatusNotFound, "user not found")
		return
	}
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	h.DB.Save(&user)
	h.ok(c, user)
}

func (h *Handler) ListAddresses(c *gin.Context) {
	var addresses []models.Address
	h.DB.Where("user_id = ?", middleware.GetUserID(c)).Order("is_default desc, id desc").Find(&addresses)
	h.ok(c, addresses)
}

func (h *Handler) CreateAddress(c *gin.Context) {
	var req addressReq
	if err := c.ShouldBindJSON(&req); err != nil {
		h.fail(c, http.StatusBadRequest, "invalid address")
		return
	}
	userID := middleware.GetUserID(c)
	if req.IsDefault {
		h.DB.Model(&models.Address{}).Where("user_id = ?", userID).Update("is_default", false)
	}
	if req.City == "" {
		req.City = "Dhaka"
	}
	if req.Label == "" {
		req.Label = "Home"
	}
	addr := models.Address{
		UserID:     userID,
		Label:      req.Label,
		Line1:      req.Line1,
		Area:       req.Area,
		City:       req.City,
		PostalCode: req.PostalCode,
		Latitude:   req.Latitude,
		Longitude:  req.Longitude,
		IsDefault:  req.IsDefault,
	}
	h.DB.Create(&addr)
	h.created(c, addr)
}

func (h *Handler) DeleteAddress(c *gin.Context) {
	id := c.Param("id")
	res := h.DB.Where("id = ? AND user_id = ?", id, middleware.GetUserID(c)).Delete(&models.Address{})
	if res.RowsAffected == 0 {
		h.fail(c, http.StatusNotFound, "address not found")
		return
	}
	h.ok(c, gin.H{"deleted": true})
}
