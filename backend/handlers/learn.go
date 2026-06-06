package handlers

import (
	"errors"
	"net/http"

	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type LearnHandler struct {
	learn services.LearnService
}

type topicRequest struct {
	Name string `json:"name" binding:"required"`
}

type learnEntryRequest struct {
	TopicID         string `json:"topic_id" binding:"required"`
	DurationMinutes int    `json:"duration_minutes" binding:"required"`
	Confidence      int    `json:"confidence" binding:"required"`
	Note            string `json:"note"`
	StudiedAt       string `json:"studied_at"`
}

type updateLearnEntryRequest struct {
	TopicID         *string `json:"topic_id"`
	DurationMinutes *int    `json:"duration_minutes"`
	Confidence      *int    `json:"confidence"`
	Note            *string `json:"note"`
	StudiedAt       *string `json:"studied_at"`
}

func NewLearnHandler(learn services.LearnService) LearnHandler {
	return LearnHandler{learn: learn}
}

func (handler LearnHandler) ListTopics(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	topics, err := handler.learn.ListTopics(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list topics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"topics": topics})
}

func (handler LearnHandler) CreateTopic(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request topicRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid topic request"})
		return
	}

	topic, err := handler.learn.CreateTopic(c.Request.Context(), services.CreateTopicInput{UserID: userID, Name: request.Name})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"topic": topic})
}

func (handler LearnHandler) UpdateTopic(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request topicRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid topic request"})
		return
	}

	topic, err := handler.learn.UpdateTopic(c.Request.Context(), services.UpdateTopicInput{UserID: userID, ID: c.Param("id"), Name: request.Name})
	if err != nil {
		writeLearnError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"topic": topic})
}

func (handler LearnHandler) DeleteTopic(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	if err := handler.learn.DeleteTopic(c.Request.Context(), userID, c.Param("id")); err != nil {
		writeLearnError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (handler LearnHandler) ListEntries(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	limit, offset := parsePagination(c)
	entries, err := handler.learn.ListEntries(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list learning entries"})
		return
	}

	total, err := handler.learn.CountEntries(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count learning entries"})
		return
	}

	c.JSON(http.StatusOK, models.PaginatedResult[models.LearnEntry]{
		Data:   entries,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

func (handler LearnHandler) CreateEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request learnEntryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid learning entry request"})
		return
	}

	entry, err := handler.learn.CreateEntry(c.Request.Context(), services.CreateLearnEntryInput{
		UserID:          userID,
		TopicID:         request.TopicID,
		DurationMinutes: request.DurationMinutes,
		Confidence:      request.Confidence,
		Note:            request.Note,
		StudiedAt:       request.StudiedAt,
	})
	if err != nil {
		writeLearnError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"entry": entry})
}

func (handler LearnHandler) UpdateEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request updateLearnEntryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid learning entry request"})
		return
	}

	entry, err := handler.learn.UpdateEntry(c.Request.Context(), services.UpdateLearnEntryInput{
		UserID:          userID,
		ID:              c.Param("id"),
		TopicID:         request.TopicID,
		DurationMinutes: request.DurationMinutes,
		Confidence:      request.Confidence,
		Note:            request.Note,
		StudiedAt:       request.StudiedAt,
	})
	if err != nil {
		writeLearnError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"entry": entry})
}

func (handler LearnHandler) DeleteEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	if err := handler.learn.DeleteEntry(c.Request.Context(), userID, c.Param("id")); err != nil {
		writeLearnError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (handler LearnHandler) WeakSpots(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	weakSpots, err := handler.learn.WeakSpots(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load weak spots"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"weak_spots": weakSpots})
}

func (handler LearnHandler) Summary(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	summary, err := handler.learn.Summary(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load learning summary"})
		return
	}

	c.JSON(http.StatusOK, summary)
}

func writeLearnError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, models.ErrNotFound) {
		status = http.StatusNotFound
	}
	c.JSON(status, gin.H{"error": err.Error()})
}
