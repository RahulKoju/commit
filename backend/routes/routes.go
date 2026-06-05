package routes

import (
	"commit/backend/handlers"
	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	AuthService  services.AuthService
	AdminService services.AdminService
}

func Register(router *gin.Engine, deps Dependencies) {
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(deps.AuthService)
	adminHandler := handlers.NewAdminHandler(deps.AdminService)

	router.GET("/healthz", healthHandler.Health)

	api := router.Group("/api/v1")
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)
	api.POST("/auth/logout", authHandler.Logout)

	protected := api.Group("")
	protected.Use(middleware.RequireAuth(deps.AuthService))
	protected.GET("/auth/me", authHandler.Me)

	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(models.RoleAdmin))
	admin.GET("/users", adminHandler.ListUsers)
	admin.DELETE("/users/:id", adminHandler.DeleteUser)
}
