package main

import (
	"context"
	"log"
	"time"

	"commit/backend/config"
	"commit/backend/db"
	"commit/backend/metrics"
	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/routes"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL(), db.PoolConfig{
		MaxConns:       cfg.DBMaxConns,
		MinConns:       cfg.DBMinConns,
		MaxLifetimeMin: cfg.DBMaxConnLifetimeMinutes,
		MaxIdleMin:     cfg.DBMaxConnIdleMinutes,
	})
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	if err := db.RunMigrations(ctx, pool, migrationFiles); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	userModel := models.NewUserModel(pool)
	taskModel := models.NewTaskModel(pool)
	focusModel := models.NewFocusModel(pool)
	noteModel := models.NewNoteModel(pool)
	habitModel := models.NewHabitModel(pool)
	refreshTokenModel := models.NewRefreshTokenModel(pool)
	passwordResetTokenModel := models.NewPasswordResetTokenModel(pool)
	dashboardModel := models.NewDashboardModel(pool)
	adminService := services.NewAdminService(userModel)
	taskService := services.NewTaskService(taskModel)
	focusService := services.NewFocusService(focusModel)
	noteService := services.NewNoteService(noteModel)
	habitService := services.NewHabitService(habitModel)
	dashboardService := services.NewDashboardService(dashboardModel, userModel)

	var emailSender services.EmailSender
	if cfg.ResendAPIKey != "" {
		emailSender = services.NewResendSender(cfg.ResendAPIKey, cfg.EmailFrom)
	} else {
		emailSender = services.NewLogSender()
	}

	authService := services.NewAuthService(userModel, refreshTokenModel, passwordResetTokenModel, emailSender, cfg.AppURL, habitService, cfg.JWTSecret, cfg.JWTExpiryHours, cfg.JWTExpiryMinutes)

	router := gin.New()
	router.Use(middleware.Logger(), gin.Recovery(), middleware.CORS(cfg.AllowedOrigins), metrics.Middleware())
	routes.Register(router, routes.Dependencies{
		AuthService:               authService,
		AdminService:              adminService,
		TaskService:               taskService,
		FocusService:              focusService,
		NoteService:               noteService,
		HabitService:              habitService,
		DashboardService:          dashboardService,
		CookieDomain:              cfg.CookieDomain,
		FocusDailyMinimumMinute:   cfg.FocusDailyMinimumMinute,
	})

	metrics.StartDBStatsCollector(pool)

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
