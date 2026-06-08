package handlers

import (
	"errors"
	"net/http"

	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	admin services.AdminService
}

func NewAdminHandler(admin services.AdminService) AdminHandler {
	return AdminHandler{admin: admin}
}

func (handler AdminHandler) ListUsers(c *gin.Context) {
	users, err := handler.admin.ListUsers(c.Request.Context())
	if err != nil {
		writeServerError(c, "failed to list users", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (handler AdminHandler) DeleteUser(c *gin.Context) {
	targetID := c.Param("id")
	currentUserID, ok := middleware.CurrentUserID(c)
	if ok && currentUserID == targetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete your own account"})
		return
	}

	if err := handler.admin.DeleteUser(c.Request.Context(), targetID); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "failed to delete user", "detail": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
