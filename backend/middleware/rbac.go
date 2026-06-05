package middleware

import (
	"net/http"

	"commit/backend/models"

	"github.com/gin-gonic/gin"
)

func RequireRole(required models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := CurrentRole(c)
		if !ok || role != required {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}
