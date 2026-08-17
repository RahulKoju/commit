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
	NoteService               services.NoteService
	ReminderService           services.ReminderService
	HabitService              services.HabitService
	DashboardService          services.DashboardService
	CookieDomain              string
	FocusDailyMinimumMinute   int
}

func Register(router *gin.Engine, deps Dependencies) {
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(deps.AuthService, deps.CookieDomain)
	adminHandler := handlers.NewAdminHandler(deps.AdminService)
	taskHandler := handlers.NewTaskHandler(deps.TaskService)
	focusHandler := handlers.NewFocusHandler(deps.FocusService, deps.FocusDailyMinimumMinute)
	noteHandler := handlers.NewNoteHandler(deps.NoteService)
	reminderHandler := handlers.NewReminderHandler(deps.ReminderService)
	habitHandler := handlers.NewHabitHandler(deps.HabitService)
	dashboardHandler := handlers.NewDashboardHandler(deps.DashboardService)

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
	protected.GET("/focus/active", focusHandler.GetActive)
	protected.GET("/focus/sessions", focusHandler.List)
	protected.POST("/focus/sessions/start", focusHandler.Start)
	protected.POST("/focus/sessions/pause", focusHandler.Pause)
	protected.POST("/focus/sessions/resume", focusHandler.Resume)
	protected.POST("/focus/sessions/heartbeat", focusHandler.Heartbeat)
	protected.POST("/focus/sessions/complete", focusHandler.Complete)
	protected.POST("/focus/sessions/discard", focusHandler.Discard)
	protected.GET("/focus/stats", focusHandler.Stats)
	protected.GET("/notes", noteHandler.List)
	protected.POST("/notes", noteHandler.Create)
	protected.PATCH("/notes/:id", noteHandler.Update)
	protected.GET("/notes/:id/backlinks", noteHandler.GetBacklinks)
	protected.DELETE("/notes/:id", noteHandler.Delete)
	protected.GET("/notes/:id/reminders", reminderHandler.ListByNote)
	protected.POST("/notes/:id/reminders", reminderHandler.Create)
	protected.PATCH("/notes/:id/reminders/:reminderId", reminderHandler.Update)
	protected.DELETE("/notes/:id/reminders/:reminderId", reminderHandler.Delete)
	protected.GET("/reminders/due", reminderHandler.Due)
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

	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(models.RoleAdmin))
	admin.GET("/users", adminHandler.ListUsers)
	admin.DELETE("/users/:id", adminHandler.DeleteUser)
}
