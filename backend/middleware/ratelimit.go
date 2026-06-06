package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	clients  map[string]*clientLimiter
	requests int
	interval time.Duration
}

func NewRateLimiter(requests int, per time.Duration) *RateLimiter {
	return &RateLimiter{
		clients:  make(map[string]*clientLimiter),
		requests: requests,
		interval: per,
	}
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	go rl.cleanup()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		rl.mu.Lock()
		cl, exists := rl.clients[ip]
		if !exists {
			cl = &clientLimiter{
				limiter:  rate.NewLimiter(rate.Limit(rl.requests)/rate.Limit(rl.interval.Seconds()), rl.requests),
				lastSeen: time.Now(),
			}
			rl.clients[ip] = cl
		}
		cl.lastSeen = time.Now()
		rl.mu.Unlock()

		if !cl.limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
			return
		}

		c.Next()
	}
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, cl := range rl.clients {
			if now.Sub(cl.lastSeen) > 10*time.Minute {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}
