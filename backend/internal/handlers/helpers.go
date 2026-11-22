package handlers

import (
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/ai"
	"github.com/sheba/pharmacy/internal/models"
	"github.com/sheba/pharmacy/internal/tracking"
	"gorm.io/gorm"
)

type Handler struct {
	DB        *gorm.DB
	JWTSecret string
	UploadDir string
	Track     *tracking.Hub
	LLM       *ai.LLMClient
	DG        *ai.DeepgramClient
}

func New(db *gorm.DB, jwtSecret, uploadDir string) *Handler {
	return &Handler{
		DB:        db,
		JWTSecret: jwtSecret,
		UploadDir: uploadDir,
		Track:     tracking.NewHub(),
		LLM:       ai.NewLLMFromEnv(),
		DG:        ai.NewDeepgramFromEnv(),
	}
}

func (h *Handler) ok(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *Handler) created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"data": data})
}

func (h *Handler) fail(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}

func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func applyEffectivePrice(m *models.Medicine) {
	if m.DiscountPct > 0 {
		m.EffectivePrice = math.Round((m.Price*(1-m.DiscountPct/100))*100) / 100
	} else {
		m.EffectivePrice = m.Price
	}
}
