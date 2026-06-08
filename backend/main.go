package main

import (
	"context"
	"log"
	"time"

	"commit/backend/config"
	"commit/backend/db"
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
	learnModel := models.NewLearnModel(pool)
	noteModel := models.NewNoteModel(pool)
	habitModel := models.NewHabitModel(pool)
	reviewModel := models.NewReviewModel(pool)
	refreshTokenModel := models.NewRefreshTokenModel(pool)
	passwordResetTokenModel := models.NewPasswordResetTokenModel(pool)
	dashboardModel := models.NewDashboardModel(pool, learnModel)
	adminService := services.NewAdminService(userModel)
	taskService := services.NewTaskService(taskModel)
	focusService := services.NewFocusService(focusModel)
	learnService := services.NewLearnService(learnModel)
	noteService := services.NewNoteService(noteModel)
	habitService := services.NewHabitService(habitModel)
	reviewService := services.NewReviewService(reviewModel)
	dashboardService := services.NewDashboardService(dashboardModel)

	var emailSender services.EmailSender
	if cfg.SMTPHost != "" {
		emailSender = services.NewSmtpSender(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom, cfg.AppURL)
	} else {
		emailSender = services.NewLogSender(cfg.AppURL)
	}

	authService := services.NewAuthService(userModel, refreshTokenModel, passwordResetTokenModel, emailSender, cfg.AppURL, habitService, cfg.JWTSecret, cfg.JWTExpiryHours, cfg.JWTExpiryMinutes)

	router := gin.New()
	router.Use(middleware.Logger(), gin.Recovery(), middleware.CORS(cfg.AllowedOrigins))
	routes.Register(router, routes.Dependencies{
		AuthService:               authService,
		AdminService:              adminService,
		TaskService:               taskService,
		FocusService:              focusService,
		LearnService:              learnService,
		NoteService:               noteService,
		HabitService:              habitService,
		ReviewService:             reviewService,
		DashboardService:          dashboardService,
		FocusDailyMinimumMinute:   cfg.FocusDailyMinimumMinute,
	})

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
