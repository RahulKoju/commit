package middleware

import (
	"net/http"

	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

const (
	ContextUserID = "userID"
	ContextRole   = "role"
	AuthCookie    = "commit_token"
)

func RequireAuth(authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Cookie(AuthCookie)
		if err != nil || cookie == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		claims, err := authService.ParseToken(cookie)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authentication token"})
			return
		}

		c.Set(ContextUserID, claims.UserID)
		c.Set(ContextRole, claims.Role)
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) (string, bool) {
	value, exists := c.Get(ContextUserID)
	if !exists {
		return "", false
	}
	userID, ok := value.(string)
	return userID, ok
}

func CurrentRole(c *gin.Context) (models.UserRole, bool) {
	value, exists := c.Get(ContextRole)
	if !exists {
		return "", false
	}
	role, ok := value.(models.UserRole)
	return role, ok
}
