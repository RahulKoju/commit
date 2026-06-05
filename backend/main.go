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

	pool, err := db.Connect(ctx, cfg.DatabaseURL())
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
	authService := services.NewAuthService(userModel, cfg.JWTSecret)
	adminService := services.NewAdminService(userModel)
	taskService := services.NewTaskService(taskModel)
	focusService := services.NewFocusService(focusModel)

	router := gin.New()
	router.Use(middleware.Logger(), gin.Recovery(), middleware.CORS())
	routes.Register(router, routes.Dependencies{
		AuthService:  authService,
		AdminService: adminService,
		TaskService:  taskService,
		FocusService: focusService,
	})

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
