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
	TaskService  services.TaskService
}

func Register(router *gin.Engine, deps Dependencies) {
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(deps.AuthService)
	adminHandler := handlers.NewAdminHandler(deps.AdminService)
	taskHandler := handlers.NewTaskHandler(deps.TaskService)

	router.GET("/healthz", healthHandler.Health)

	api := router.Group("/api/v1")
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)
	api.POST("/auth/logout", authHandler.Logout)

	protected := api.Group("")
	protected.Use(middleware.RequireAuth(deps.AuthService))
	protected.GET("/auth/me", authHandler.Me)
	protected.GET("/tasks", taskHandler.List)
	protected.POST("/tasks", taskHandler.Create)
	protected.PATCH("/tasks/:id", taskHandler.Update)
	protected.DELETE("/tasks/:id", taskHandler.Delete)

	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(models.RoleAdmin))
	admin.GET("/users", adminHandler.ListUsers)
	admin.DELETE("/users/:id", adminHandler.DeleteUser)
}
