package handlers

import (
	"errors"
	"net/http"

	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	tasks services.TaskService
}

type taskRequest struct {
	TopicID       string `json:"topic_id"`
	Title         string `json:"title" binding:"required"`
	Description   string `json:"description"`
	Priority      string `json:"priority"`
	ScheduledDate string `json:"scheduled_date"`
	Status        string `json:"status"`
}

type updateTaskRequest struct {
	TopicID       *string `json:"topic_id"`
	Title         *string `json:"title"`
	Description   *string `json:"description"`
	Priority      *string `json:"priority"`
	ScheduledDate *string `json:"scheduled_date"`
	Status        *string `json:"status"`
}

func NewTaskHandler(tasks services.TaskService) TaskHandler {
	return TaskHandler{tasks: tasks}
}

func (handler TaskHandler) List(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	tasks, err := handler.tasks.List(c.Request.Context(), services.ListTasksInput{
		UserID:   userID,
		View:     c.DefaultQuery("view", string(models.TaskViewToday)),
		TopicID:  c.Query("topic_id"),
		Priority: c.Query("priority"),
		Status:   c.Query("status"),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tasks": tasks})
}

func (handler TaskHandler) Create(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request taskRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task request"})
		return
	}

	task, err := handler.tasks.Create(c.Request.Context(), services.CreateTaskInput{
		UserID:        userID,
		TopicID:       request.TopicID,
		Title:         request.Title,
		Description:   request.Description,
		Priority:      request.Priority,
		ScheduledDate: request.ScheduledDate,
		Status:        request.Status,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"task": task})
}

func (handler TaskHandler) Update(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request updateTaskRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task request"})
		return
	}

	task, err := handler.tasks.Update(c.Request.Context(), services.UpdateTaskInput{
		UserID:        userID,
		ID:            c.Param("id"),
		TopicID:       request.TopicID,
		Title:         request.Title,
		Description:   request.Description,
		Priority:      request.Priority,
		ScheduledDate: request.ScheduledDate,
		Status:        request.Status,
	})
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"task": task})
}

func (handler TaskHandler) Delete(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	if err := handler.tasks.Delete(c.Request.Context(), userID, c.Param("id")); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "failed to delete task"})
		return
	}

	c.Status(http.StatusNoContent)
}
