package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/ai"
	"github.com/sheba/pharmacy/internal/config"
	"github.com/sheba/pharmacy/internal/database"
	"github.com/sheba/pharmacy/internal/handlers"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/seed"
)

func main() {
	ai.LoadDotEnv(".env")
	ai.LoadDotEnv("backend/.env")

	cfg := config.Load()
	_ = os.MkdirAll(cfg.UploadDir, 0o755)

	db := database.Connect(cfg.DatabasePath)
	seed.Run(db)

	h := handlers.New(db, cfg.JWTSecret, cfg.UploadDir)
	log.Printf("AI: llm=%v deepgram=%v model=%s", h.LLM != nil && h.LLM.Enabled(), h.DG != nil && h.DG.Enabled(), func() string {
		if h.LLM == nil {
			return ""
		}
		return h.LLM.Model
	}())

	r := gin.Default()
	r.Use(middleware.CORS(cfg.CORSOrigin))
	r.MaxMultipartMemory = 10 << 20

	absUpload, _ := filepath.Abs(cfg.UploadDir)
	r.Static("/uploads", absUpload)

	api := r.Group("/api")
	{
		api.GET("/health", h.Health)

		api.POST("/auth/register", h.Register)
		api.POST("/auth/login", h.Login)
		api.POST("/partners/pharmacy", h.RegisterPharmacyPartner)
		api.POST("/partners/rider", h.RegisterRiderPartner)
		api.POST("/partners/ambulance", h.RegisterAmbulancePartner)
		api.POST("/partners/doctor", h.RegisterDoctorPartner)
		api.GET("/partners", h.ListPartnerApplications)
		api.GET("/doctors", h.ListDoctors)
		api.GET("/doctors/:id", h.GetDoctor)
		api.GET("/doctors/:id/slots", h.ListDoctorSlots)

		api.GET("/pharmacies", h.ListPharmacies)
		api.GET("/pharmacies/:id", h.GetPharmacy)
		api.GET("/pharmacies/:id/medicines", h.GetPharmacyMedicines)
		api.GET("/categories", h.ListCategories)
		api.GET("/categories/:slug", h.GetCategory)
		api.GET("/categories/:slug/medicines", h.GetCategoryMedicines)
		api.GET("/banners", h.ListBanners)
		api.GET("/areas", h.Areas)
		api.GET("/medicines/search", h.SearchMedicines)
		api.GET("/medicines/featured", h.FeaturedMedicines)
		api.GET("/medicines/:id", h.GetMedicine)

		auth := api.Group("/")
		auth.Use(middleware.AuthRequired(cfg.JWTSecret))
		{
			auth.GET("/me", h.Me)
			auth.PATCH("/me", h.UpdateProfile)
			auth.GET("/addresses", h.ListAddresses)
			auth.POST("/addresses", h.CreateAddress)
			auth.DELETE("/addresses/:id", h.DeleteAddress)

			auth.POST("/prescriptions", h.UploadPrescription)
			auth.GET("/prescriptions", h.ListPrescriptions)
			auth.GET("/prescriptions/:id", h.GetPrescription)
			auth.PATCH("/prescriptions/:id/pharmacy", h.AssignPrescriptionPharmacy)
			auth.POST("/prescriptions/:id/order", h.OrderFromPrescription)

			auth.POST("/consultations", h.StartConsultation)
			auth.GET("/consultations", h.ListMyConsultations)
			auth.GET("/consultations/:id", h.GetConsultation)
			auth.POST("/consultations/:id/messages", h.PostConsultMessage)
			auth.POST("/consultations/:id/match", h.MatchDoctor)
			auth.POST("/consultations/:id/accept", h.AcceptConsultation)
			auth.POST("/consultations/:id/prescribe", h.PrescribeConsultation)

			auth.GET("/doctor/inbox", h.DoctorInbox)
			auth.GET("/doctor/profile", h.GetMyDoctorProfile)
			auth.GET("/doctor/incoming", h.DoctorIncomingCalls)

			auth.GET("/voice/status", h.VoiceStatus)
			auth.POST("/voice/transcribe", h.VoiceTranscribe)
			auth.POST("/voice/speak", h.VoiceSpeak)
			auth.POST("/voice/turn", h.VoiceTurn)

			auth.POST("/appointments", h.BookAppointment)
			auth.GET("/appointments", h.ListAppointments)
			auth.GET("/appointments/:id", h.GetAppointment)
			auth.POST("/appointments/:id/cancel", h.CancelAppointment)
			auth.POST("/appointments/:id/start-call", h.StartCall)

			auth.GET("/calls/:id", h.GetCall)
			auth.POST("/calls/:id/answer", h.AnswerCall)
			auth.POST("/calls/:id/end", h.EndCall)
			auth.POST("/calls/:id/signals", h.PostCallSignal)
			auth.GET("/calls/:id/signals", h.ListCallSignals)

			auth.POST("/orders", h.CreateOrder)
			auth.GET("/orders", h.ListOrders)
			auth.GET("/orders/:id", h.GetOrder)
			auth.GET("/orders/:id/tracking", h.GetOrderTracking)
			auth.GET("/orders/:id/live", h.LiveOrderTracking)
			auth.POST("/orders/:id/cancel", h.CancelOrder)
			auth.POST("/orders/:id/complete", h.MarkDelivered)
			auth.POST("/reviews", h.CreateReview)
		}
	}

	log.Printf("Sheba API listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
