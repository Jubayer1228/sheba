package handlers

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/models"
)

func (h *Handler) ListPharmacies(c *gin.Context) {
	lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
	lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
	area := strings.TrimSpace(c.Query("area"))
	city := strings.TrimSpace(c.DefaultQuery("city", "Dhaka"))
	q := strings.TrimSpace(c.Query("q"))
	sortBy := c.DefaultQuery("sort", "distance")
	onlyOpen := c.Query("open") == "1"
	acceptsRx := c.Query("rx") == "1"
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := h.DB.Model(&models.Pharmacy{})
	if city != "" {
		query = query.Where("city = ?", city)
	}
	if area != "" {
		query = query.Where("area LIKE ?", "%"+area+"%")
	}
	if q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR tags LIKE ? OR area LIKE ?", like, like, like)
	}
	if onlyOpen {
		query = query.Where("is_open = ?", true)
	}
	if acceptsRx {
		query = query.Where("accepts_rx = ?", true)
	}

	var pharmacies []models.Pharmacy
	query.Find(&pharmacies)

	hasCoords := lat != 0 && lng != 0
	for i := range pharmacies {
		if hasCoords {
			pharmacies[i].DistanceKm = haversineKm(lat, lng, pharmacies[i].Latitude, pharmacies[i].Longitude)
		}
	}

	switch sortBy {
	case "rating":
		sort.Slice(pharmacies, func(i, j int) bool { return pharmacies[i].Rating > pharmacies[j].Rating })
	case "delivery_fee":
		sort.Slice(pharmacies, func(i, j int) bool { return pharmacies[i].DeliveryFee < pharmacies[j].DeliveryFee })
	case "fastest":
		sort.Slice(pharmacies, func(i, j int) bool {
			return pharmacies[i].DeliveryMinutes < pharmacies[j].DeliveryMinutes
		})
	default:
		if hasCoords {
			sort.Slice(pharmacies, func(i, j int) bool {
				return pharmacies[i].DistanceKm < pharmacies[j].DistanceKm
			})
		} else {
			sort.Slice(pharmacies, func(i, j int) bool { return pharmacies[i].Rating > pharmacies[j].Rating })
		}
	}

	if len(pharmacies) > limit {
		pharmacies = pharmacies[:limit]
	}

	h.ok(c, pharmacies)
}

func (h *Handler) GetPharmacy(c *gin.Context) {
	id := c.Param("id")
	var pharmacy models.Pharmacy
	if err := h.DB.First(&pharmacy, id).Error; err != nil {
		h.fail(c, http.StatusNotFound, "pharmacy not found")
		return
	}
	lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
	lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
	if lat != 0 && lng != 0 {
		pharmacy.DistanceKm = haversineKm(lat, lng, pharmacy.Latitude, pharmacy.Longitude)
	}
	h.ok(c, pharmacy)
}

func (h *Handler) GetPharmacyMedicines(c *gin.Context) {
	id := c.Param("id")
	categoryID := c.Query("category_id")
	q := strings.TrimSpace(c.Query("q"))
	rxOnly := c.Query("rx") == "1"

	query := h.DB.Where("pharmacy_id = ?", id).Preload("Category")
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR generic_name LIKE ? OR brand LIKE ?", like, like, like)
	}
	if rxOnly {
		query = query.Where("requires_rx = ?", true)
	}

	var medicines []models.Medicine
	query.Order("is_featured desc, name asc").Find(&medicines)
	for i := range medicines {
		applyEffectivePrice(&medicines[i])
	}
	h.ok(c, medicines)
}

func (h *Handler) ListCategories(c *gin.Context) {
	var categories []models.Category
	h.DB.Order("sort_order asc, name asc").Find(&categories)
	h.ok(c, categories)
}

func (h *Handler) GetCategory(c *gin.Context) {
	slug := c.Param("slug")
	var category models.Category
	if err := h.DB.Where("slug = ?", slug).First(&category).Error; err != nil {
		h.fail(c, http.StatusNotFound, "category not found")
		return
	}
	var count int64
	h.DB.Model(&models.Medicine{}).Where("category_id = ?", category.ID).Count(&count)
	h.ok(c, gin.H{"category": category, "medicine_count": count})
}

func (h *Handler) GetCategoryMedicines(c *gin.Context) {
	slug := c.Param("slug")
	var category models.Category
	if err := h.DB.Where("slug = ?", slug).First(&category).Error; err != nil {
		h.fail(c, http.StatusNotFound, "category not found")
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	sortBy := c.DefaultQuery("sort", "featured")
	rxOnly := c.Query("rx") == "1"
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "60"))
	if limit <= 0 || limit > 120 {
		limit = 60
	}

	query := h.DB.Preload("Pharmacy").Preload("Category").Where("category_id = ?", category.ID)
	if q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR generic_name LIKE ? OR brand LIKE ?", like, like, like)
	}
	if rxOnly {
		query = query.Where("requires_rx = ?", true)
	}
	switch sortBy {
	case "price_asc":
		query = query.Order("price asc")
	case "price_desc":
		query = query.Order("price desc")
	case "name":
		query = query.Order("name asc")
	default:
		query = query.Order("is_featured desc, name asc")
	}

	var medicines []models.Medicine
	query.Limit(limit).Find(&medicines)
	for i := range medicines {
		applyEffectivePrice(&medicines[i])
	}
	h.ok(c, gin.H{"category": category, "medicines": medicines})
}

func (h *Handler) ListBanners(c *gin.Context) {
	var banners []models.Banner
	h.DB.Where("is_active = ?", true).Order("sort_order asc").Find(&banners)
	h.ok(c, banners)
}

func (h *Handler) SearchMedicines(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
	lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "40"))
	if limit <= 0 || limit > 100 {
		limit = 40
	}
	if q == "" {
		h.ok(c, []models.Medicine{})
		return
	}

	like := "%" + q + "%"
	var medicines []models.Medicine
	h.DB.Preload("Pharmacy").Preload("Category").
		Where("name LIKE ? OR generic_name LIKE ? OR brand LIKE ?", like, like, like).
		Limit(limit).Find(&medicines)

	for i := range medicines {
		applyEffectivePrice(&medicines[i])
		if medicines[i].Pharmacy != nil && lat != 0 && lng != 0 {
			medicines[i].Pharmacy.DistanceKm = haversineKm(lat, lng, medicines[i].Pharmacy.Latitude, medicines[i].Pharmacy.Longitude)
		}
	}

	h.ok(c, medicines)
}

func (h *Handler) GetMedicine(c *gin.Context) {
	var medicine models.Medicine
	if err := h.DB.Preload("Pharmacy").Preload("Category").First(&medicine, c.Param("id")).Error; err != nil {
		h.fail(c, http.StatusNotFound, "medicine not found")
		return
	}
	applyEffectivePrice(&medicine)
	h.ok(c, medicine)
}

func (h *Handler) FeaturedMedicines(c *gin.Context) {
	var medicines []models.Medicine
	h.DB.Preload("Pharmacy").Where("is_featured = ?", true).Limit(24).Find(&medicines)
	for i := range medicines {
		applyEffectivePrice(&medicines[i])
	}
	h.ok(c, medicines)
}

func (h *Handler) Areas(c *gin.Context) {
	type areaRow struct {
		Area  string `json:"area"`
		Count int64  `json:"count"`
	}
	var rows []areaRow
	h.DB.Model(&models.Pharmacy{}).
		Select("area, count(*) as count").
		Where("city = ?", c.DefaultQuery("city", "Dhaka")).
		Group("area").
		Order("count desc").
		Scan(&rows)
	h.ok(c, rows)
}
