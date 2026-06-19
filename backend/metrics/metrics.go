package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	HttpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "commit_http_requests_total",
			Help: "Total number of HTTP requests by method, path, and status code",
		},
		[]string{"method", "path", "status"},
	)

	HttpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "commit_http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		},
		[]string{"method", "path"},
	)

	HttpRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "commit_http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
	)

	DbPoolAcquiredConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "commit_db_pool_acquired_connections",
			Help: "Number of currently acquired database connections",
		},
	)

	DbPoolIdleConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "commit_db_pool_idle_connections",
			Help: "Number of idle database connections in the pool",
		},
	)

	DbPoolTotalConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "commit_db_pool_total_connections",
			Help: "Total number of connections in the database pool",
		},
	)

	TasksCreatedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "commit_tasks_created_total",
			Help: "Total number of tasks created",
		},
	)

	HabitsLoggedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "commit_habits_logged_total",
			Help: "Total number of habit completions logged",
		},
	)

	FocusSessionsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "commit_focus_sessions_total",
			Help: "Total number of focus sessions completed",
		},
	)

	FlashcardsReviewedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "commit_flashcards_reviewed_total",
			Help: "Total number of flashcard reviews by rating",
		},
		[]string{"rating"},
	)

	NotesCreatedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "commit_notes_created_total",
			Help: "Total number of notes created",
		},
	)
)

func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = "unmatched"
		}

		HttpRequestsInFlight.Inc()
		c.Next()
		HttpRequestsInFlight.Dec()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		HttpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		HttpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}
