package handlers

import (
	"errors"
	"net/http"

	"commit/backend/metrics"
	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type NoteHandler struct {
	notes services.NoteService
}

type noteRequest struct {
	Title    string   `json:"title" binding:"required"`
	Body     string   `json:"body"`
	TopicIDs []string `json:"topic_ids"`
	Tags     []string `json:"tags"`
}

type updateNoteRequest struct {
	Title    *string   `json:"title"`
	Body     *string   `json:"body"`
	TopicIDs *[]string `json:"topic_ids"`
	Tags     *[]string `json:"tags"`
}

func NewNoteHandler(notes services.NoteService) NoteHandler {
	return NoteHandler{notes: notes}
}

func (handler NoteHandler) List(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	limit, offset := parsePagination(c)
	input := services.ListNotesInput{
		UserID: userID,
		Search: c.Query("search"),
		Limit:  limit,
		Offset: offset,
	}

	notes, err := handler.notes.List(c.Request.Context(), input)
	if err != nil {
		writeServerError(c, "failed to list notes", err)
		return
	}

	total, err := handler.notes.Count(c.Request.Context(), input)
	if err != nil {
		writeServerError(c, "failed to count notes", err)
		return
	}

	c.JSON(http.StatusOK, models.PaginatedResult[models.Note]{
		Data:   notes,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

func (handler NoteHandler) Create(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request noteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note request"})
		return
	}

	note, err := handler.notes.Create(c.Request.Context(), services.CreateNoteInput{
		UserID:   userID,
		Title:    request.Title,
		Body:     request.Body,
		TopicIDs: request.TopicIDs,
		Tags:     request.Tags,
	})
	if err != nil {
		writeNoteError(c, err)
		return
	}

	metrics.NotesCreatedTotal.Inc()
	c.JSON(http.StatusCreated, gin.H{"note": note})
}

func (handler NoteHandler) Update(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request updateNoteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note request"})
		return
	}

	note, err := handler.notes.Update(c.Request.Context(), services.UpdateNoteInput{
		UserID:   userID,
		ID:       c.Param("id"),
		Title:    request.Title,
		Body:     request.Body,
		TopicIDs: request.TopicIDs,
		Tags:     request.Tags,
	})
	if err != nil {
		writeNoteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"note": note})
}

func (handler NoteHandler) GetBacklinks(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	links, err := handler.notes.GetBacklinks(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		writeServerError(c, "failed to get backlinks", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"backlinks": links})
}

func (handler NoteHandler) Delete(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	if err := handler.notes.Delete(c.Request.Context(), userID, c.Param("id")); err != nil {
		writeNoteError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func writeNoteError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, models.ErrNotFound) {
		status = http.StatusNotFound
	}
	c.JSON(status, gin.H{"error": err.Error()})
}
