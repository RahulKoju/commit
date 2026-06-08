package handlers

import (
	"log"
	"net/http"
	"strconv"

	"commit/backend/middleware"
	"commit/backend/models"

	"github.com/gin-gonic/gin"
)

func currentUserID(c *gin.Context) (string, bool) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return "", false
	}
	return userID, true
}

func parsePagination(c *gin.Context) (int, int) {
	limit := models.DefaultLimit
	offset := 0

	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		if l > models.MaxLimit {
			limit = models.MaxLimit
		} else {
			limit = l
		}
	}
	if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
		offset = o
	}

	return limit, offset
}

// writeServerError logs the error and returns it in the JSON response for debugging.
func writeServerError(c *gin.Context, label string, err error) {
	log.Printf("[ERROR] %s: %v", label, err)
	c.JSON(http.StatusInternalServerError, gin.H{
		"error":  label,
		"detail": err.Error(),
	})
}
