package handlers

import (
	"errors"
	"net/http"

	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type ReviewHandler struct {
	reviews services.ReviewService
}

type createReviewRequest struct {
	Type           string `json:"type" binding:"required"`
	PeriodStart    string `json:"period_start"`
	PeriodEnd      string `json:"period_end"`
	ReflectionText string `json:"reflection_text"`
}

func NewReviewHandler(reviews services.ReviewService) ReviewHandler {
	return ReviewHandler{reviews: reviews}
}

func (handler ReviewHandler) List(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	reviews, err := handler.reviews.List(c.Request.Context(), services.ListReviewsInput{
		UserID: userID,
		Type:   c.Query("type"),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reviews": reviews})
}

func (handler ReviewHandler) Create(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request createReviewRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review request"})
		return
	}

	review, err := handler.reviews.Create(c.Request.Context(), services.CreateReviewInput{
		UserID:         userID,
		Type:           request.Type,
		PeriodStart:    request.PeriodStart,
		PeriodEnd:      request.PeriodEnd,
		ReflectionText: request.ReflectionText,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"review": review})
}

func (handler ReviewHandler) Get(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	review, err := handler.reviews.GetByID(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"review": review})
}
