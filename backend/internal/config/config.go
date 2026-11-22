package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         string
	JWTSecret    string
	UploadDir    string
	DatabasePath string
	CORSOrigin   string
}

func Load() Config {
	return Config{
		Port:         getEnv("PORT", "8080"),
		JWTSecret:    getEnv("JWT_SECRET", "sheba-bd-pharmacy-secret-change-in-prod"),
		UploadDir:    getEnv("UPLOAD_DIR", "uploads"),
		DatabasePath: getEnv("DATABASE_PATH", "sheba.db"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func GetEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
