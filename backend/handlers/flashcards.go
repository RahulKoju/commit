package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type FlashcardHandler struct {
	flashcards services.FlashcardService
}

func NewFlashcardHandler(flashcards services.FlashcardService) FlashcardHandler {
	return FlashcardHandler{flashcards: flashcards}
}

func (handler FlashcardHandler) List(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	limit, offset := parsePagination(c)
	topicID := c.Query("topic_id")

	cards, err := handler.flashcards.List(c.Request.Context(), userID, limit, offset, topicID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list flashcards"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cards})
}

func (handler FlashcardHandler) Due(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	limitStr := c.Query("limit")
	limit := 20
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	cards, err := handler.flashcards.Due(c.Request.Context(), userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch due flashcards"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cards})
}

func (handler FlashcardHandler) Create(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request struct {
		Front   string `json:"front" binding:"required"`
		Back    string `json:"back" binding:"required"`
		TopicID string `json:"topic_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "front and back are required"})
		return
	}

	card, err := handler.flashcards.Create(c.Request.Context(), services.CreateFlashcardInput{
		UserID:  userID,
		TopicID: request.TopicID,
		Front:   request.Front,
		Back:    request.Back,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"card": card})
}

func (handler FlashcardHandler) Update(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id := c.Param("id")
	var request struct {
		Front   string `json:"front"`
		Back    string `json:"back"`
		TopicID string `json:"topic_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if request.Front == "" && request.Back == "" && request.TopicID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	card, err := handler.flashcards.Update(c.Request.Context(), services.UpdateFlashcardInput{
		UserID:  userID,
		ID:      id,
		TopicID: request.TopicID,
		Front:   request.Front,
		Back:    request.Back,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}

func (handler FlashcardHandler) Delete(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id := c.Param("id")
	if err := handler.flashcards.Delete(c.Request.Context(), userID, id); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type reviewRequest struct {
	Quality int `json:"quality" binding:"required"`
}

func (handler FlashcardHandler) Review(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id := c.Param("id")
	var request reviewRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quality is required"})
		return
	}

	card, err := handler.flashcards.Review(c.Request.Context(), services.ReviewFlashcardInput{
		UserID:  userID,
		ID:      id,
		Quality: request.Quality,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}
