package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DBHost              string
	DBPort              string
	DBUser              string
	DBPassword          string
	DBName              string
	JWTSecret           string
	Port                string
	AppEnv              string
	AllowedOrigins      []string
	FocusDailyMinimumMinute int
	JWTExpiryHours          int
	JWTExpiryMinutes        int
	DBMaxConns              int
	DBMinConns              int
	DBMaxConnLifetimeMinutes int
	DBMaxConnIdleMinutes     int
	ResendAPIKey string
	EmailFrom    string
	AppURL       string
}

func Load() (Config, error) {
	allowedOrigins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
	for i := range allowedOrigins {
		allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
	}

	focusDailyMinimum := envInt("FOCUS_DAILY_MINIMUM_MINUTES", 120)
	jwtExpiryHours := envInt("JWT_EXPIRY_HOURS", 168)
	jwtExpiryMinutes := envInt("JWT_EXPIRY_MINUTES", 1440)
	dbMaxConns := envInt("DB_MAX_CONNS", 10)
	dbMinConns := envInt("DB_MIN_CONNS", 1)
	dbMaxConnLifetime := envInt("DB_MAX_CONN_LIFETIME_MINUTES", 60)
	dbMaxConnIdle := envInt("DB_MAX_CONN_IDLE_MINUTES", 30)

	cfg := Config{
		DBHost:                  os.Getenv("DB_HOST"),
		DBPort:                  os.Getenv("DB_PORT"),
		DBUser:                  os.Getenv("DB_USER"),
		DBPassword:              os.Getenv("DB_PASSWORD"),
		DBName:                  os.Getenv("DB_NAME"),
		JWTSecret:               os.Getenv("JWT_SECRET"),
		Port:                    os.Getenv("PORT"),
		AppEnv:                  os.Getenv("APP_ENV"),
		AllowedOrigins:          allowedOrigins,
		FocusDailyMinimumMinute: focusDailyMinimum,
		JWTExpiryHours:          jwtExpiryHours,
		JWTExpiryMinutes:        jwtExpiryMinutes,
		DBMaxConns:              dbMaxConns,
		DBMinConns:              dbMinConns,
		DBMaxConnLifetimeMinutes: dbMaxConnLifetime,
		DBMaxConnIdleMinutes:     dbMaxConnIdle,
		ResendAPIKey:            os.Getenv("RESEND_API_KEY"),
		EmailFrom:               os.Getenv("EMAIL_FROM"),
		AppURL:                  os.Getenv("VITE_APP_URL"),
	}

	missing := missingEnv(cfg)
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required environment variables: %v", missing)
	}

	if _, err := strconv.Atoi(cfg.DBPort); err != nil {
		return Config{}, fmt.Errorf("DB_PORT must be numeric: %w", err)
	}

	if _, err := strconv.Atoi(cfg.Port); err != nil {
		return Config{}, fmt.Errorf("PORT must be numeric: %w", err)
	}

	return cfg, nil
}

func (cfg Config) DatabaseURL() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
	)
}

func envInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return n
}

func missingEnv(cfg Config) []string {
	values := map[string]string{
		"DB_HOST":     cfg.DBHost,
		"DB_PORT":     cfg.DBPort,
		"DB_USER":     cfg.DBUser,
		"DB_PASSWORD": cfg.DBPassword,
		"DB_NAME":         cfg.DBName,
		"JWT_SECRET":      cfg.JWTSecret,
		"PORT":            cfg.Port,
		"APP_ENV":         cfg.AppEnv,
		"ALLOWED_ORIGINS": strings.Join(cfg.AllowedOrigins, ","),
	}

	missing := make([]string, 0)
	for key, value := range values {
		if value == "" {
			missing = append(missing, key)
		}
	}

	return missing
}
