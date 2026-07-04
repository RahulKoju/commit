package routes

import (
	"os"
	"strconv"
	"time"

	"commit/backend/handlers"
	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Dependencies struct {
	AuthService               services.AuthService
	AdminService              services.AdminService
	TaskService               services.TaskService
	FocusService              services.FocusService
	LearnService              services.LearnService
	NoteService               services.NoteService
	HabitService              services.HabitService
	ReviewService             services.ReviewService
	DashboardService          services.DashboardService
	FlashcardService          services.FlashcardService
	CookieDomain              string
	FocusDailyMinimumMinute   int
}

func Register(router *gin.Engine, deps Dependencies) {
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(deps.AuthService, deps.CookieDomain)
	adminHandler := handlers.NewAdminHandler(deps.AdminService)
	taskHandler := handlers.NewTaskHandler(deps.TaskService)
	focusHandler := handlers.NewFocusHandler(deps.FocusService, deps.FocusDailyMinimumMinute)
	learnHandler := handlers.NewLearnHandler(deps.LearnService)
	noteHandler := handlers.NewNoteHandler(deps.NoteService)
	habitHandler := handlers.NewHabitHandler(deps.HabitService)
	reviewHandler := handlers.NewReviewHandler(deps.ReviewService)
	dashboardHandler := handlers.NewDashboardHandler(deps.DashboardService)
	flashcardHandler := handlers.NewFlashcardHandler(deps.FlashcardService)

	router.GET("/healthz", healthHandler.Health)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := router.Group("/api/v1")
	loginLimit := 5
	if v := os.Getenv("LOGIN_RATE_LIMIT"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			loginLimit = parsed
		}
	}
	loginLimiter := middleware.NewRateLimiter(loginLimit, 1*time.Minute)
	registerLimiter := middleware.NewRateLimiter(3, 1*time.Minute)
	forgotLimiter := middleware.NewRateLimiter(3, 1*time.Minute)
	api.POST("/auth/register", registerLimiter.Middleware(), authHandler.Register)
	api.POST("/auth/login", loginLimiter.Middleware(), authHandler.Login)
	api.POST("/auth/refresh", authHandler.Refresh)
	api.POST("/auth/logout", authHandler.Logout)
	api.POST("/auth/forgot-password", forgotLimiter.Middleware(), authHandler.ForgotPassword)
	api.POST("/auth/reset-password", authHandler.ResetPassword)

	protected := api.Group("")
	protected.Use(middleware.RequireAuth(deps.AuthService))
	protected.GET("/auth/me", authHandler.Me)
	protected.GET("/dashboard/summary", dashboardHandler.Summary)
	protected.GET("/dashboard/activity-heatmap", dashboardHandler.ActivityHeatmap)
	protected.GET("/dashboard/layout", dashboardHandler.GetLayout)
	protected.PATCH("/dashboard/layout", dashboardHandler.SaveLayout)
	protected.GET("/tasks", taskHandler.List)
	protected.POST("/tasks", taskHandler.Create)
	protected.PATCH("/tasks/:id", taskHandler.Update)
	protected.DELETE("/tasks/:id", taskHandler.Delete)
	protected.GET("/focus/sessions", focusHandler.List)
	protected.POST("/focus/sessions", focusHandler.Create)
	protected.GET("/focus/stats", focusHandler.Stats)
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
	protected.GET("/notes/:id/backlinks", noteHandler.GetBacklinks)
	protected.DELETE("/notes/:id", noteHandler.Delete)
	protected.GET("/habit-categories", habitHandler.ListCategories)
	protected.POST("/habit-categories", habitHandler.CreateCategory)
	protected.PATCH("/habit-categories/:id", habitHandler.UpdateCategory)
	protected.DELETE("/habit-categories/:id", habitHandler.DeleteCategory)
	protected.GET("/habits", habitHandler.ListHabits)
	protected.POST("/habits", habitHandler.CreateHabit)
	protected.GET("/habits/export", habitHandler.ExportCSV)
	protected.PATCH("/habits/:id", habitHandler.UpdateHabit)
	protected.DELETE("/habits/:id", habitHandler.DeleteHabit)
	protected.POST("/habits/:id/log", habitHandler.LogHabit)
	protected.GET("/habits/:id/analytics", habitHandler.Analytics)
	protected.GET("/reviews", reviewHandler.List)
	protected.POST("/reviews", reviewHandler.Create)
	protected.GET("/reviews/:id", reviewHandler.Get)
	protected.GET("/flashcards", flashcardHandler.List)
	protected.GET("/flashcards/due", flashcardHandler.Due)
	protected.POST("/flashcards", flashcardHandler.Create)
	protected.PATCH("/flashcards/:id", flashcardHandler.Update)
	protected.DELETE("/flashcards/:id", flashcardHandler.Delete)
	protected.POST("/flashcards/:id/review", flashcardHandler.Review)

	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(models.RoleAdmin))
	admin.GET("/users", adminHandler.ListUsers)
	admin.DELETE("/users/:id", adminHandler.DeleteUser)
}
