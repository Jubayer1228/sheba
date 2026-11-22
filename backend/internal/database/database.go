package database

import (
	"log"
	"os"
	"path/filepath"

	"github.com/sheba/pharmacy/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(path string) *gorm.DB {
	dir := filepath.Dir(path)
	if dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0o755)
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Address{},
		&models.Pharmacy{},
		&models.Category{},
		&models.Medicine{},
		&models.Prescription{},
		&models.PrescriptionItem{},
		&models.Order{},
		&models.OrderItem{},
		&models.OrderStatusEvent{},
		&models.Review{},
		&models.Banner{},
		&models.PartnerApplication{},
		&models.DoctorProfile{},
		&models.Consultation{},
		&models.ConsultMessage{},
		&models.DoctorSlot{},
		&models.Appointment{},
		&models.CallSession{},
		&models.CallSignal{},
	); err != nil {
		log.Fatalf("auto migrate failed: %v", err)
	}

	return db
}
