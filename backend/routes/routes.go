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
	FocusService services.FocusService
	LearnService services.LearnService
	NoteService  services.NoteService
}

func Register(router *gin.Engine, deps Dependencies) {
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(deps.AuthService)
	adminHandler := handlers.NewAdminHandler(deps.AdminService)
	taskHandler := handlers.NewTaskHandler(deps.TaskService)
	focusHandler := handlers.NewFocusHandler(deps.FocusService)
	learnHandler := handlers.NewLearnHandler(deps.LearnService)
	noteHandler := handlers.NewNoteHandler(deps.NoteService)

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
	protected.GET("/focus/sessions", focusHandler.List)
	protected.POST("/focus/sessions", focusHandler.Create)
	protected.GET("/learn/entries", learnHandler.ListEntries)
	protected.POST("/learn/entries", learnHandler.CreateEntry)
	protected.PATCH("/learn/entries/:id", learnHandler.UpdateEntry)
	protected.DELETE("/learn/entries/:id", learnHandler.DeleteEntry)
	protected.GET("/learn/topics", learnHandler.ListTopics)
	protected.POST("/learn/topics", learnHandler.CreateTopic)
	protected.PATCH("/learn/topics/:id", learnHandler.UpdateTopic)
	protected.DELETE("/learn/topics/:id", learnHandler.DeleteTopic)
	protected.GET("/learn/weakspots", learnHandler.WeakSpots)
	protected.GET("/learn/summary", learnHandler.Summary)
	protected.GET("/notes", noteHandler.List)
	protected.POST("/notes", noteHandler.Create)
	protected.PATCH("/notes/:id", noteHandler.Update)
	protected.DELETE("/notes/:id", noteHandler.Delete)

	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(models.RoleAdmin))
	admin.GET("/users", adminHandler.ListUsers)
	admin.DELETE("/users/:id", adminHandler.DeleteUser)
}
