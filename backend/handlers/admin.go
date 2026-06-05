package handlers

import (
	"errors"
	"net/http"

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (handler AdminHandler) DeleteUser(c *gin.Context) {
	if err := handler.admin.DeleteUser(c.Request.Context(), c.Param("id")); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "failed to delete user"})
		return
	}

	c.Status(http.StatusNoContent)
}
