package handlers

import (
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"time"

	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type HabitHandler struct {
	habits services.HabitService
}

type habitCategoryRequest struct {
	Name string `json:"name" binding:"required"`
}

type habitRequest struct {
	CategoryID    string   `json:"category_id" binding:"required"`
	Name          string   `json:"name" binding:"required"`
	Description   string   `json:"description"`
	Type          string   `json:"type" binding:"required"`
	TargetValue   *float64 `json:"target_value"`
	TargetUnit    *string  `json:"target_unit"`
	FrequencyType string   `json:"frequency_type"`
	FrequencyDays []int    `json:"frequency_days"`
	WeeklyGoal    int      `json:"weekly_goal"`
	SortOrder     int      `json:"sort_order"`
}

type updateHabitRequest struct {
	CategoryID    *string  `json:"category_id"`
	Name          *string  `json:"name"`
	Description   *string  `json:"description"`
	Type          *string  `json:"type"`
	TargetValue   *float64 `json:"target_value"`
	TargetUnit    *string  `json:"target_unit"`
	FrequencyType *string  `json:"frequency_type"`
	FrequencyDays *[]int   `json:"frequency_days"`
	WeeklyGoal    *int     `json:"weekly_goal"`
	SortOrder     *int     `json:"sort_order"`
}

type habitLogRequest struct {
	LoggedDate string  `json:"logged_date"`
	Value      float64 `json:"value"`
	Note       string  `json:"note"`
}

func NewHabitHandler(habits services.HabitService) HabitHandler {
	return HabitHandler{habits: habits}
}

func (handler HabitHandler) ExportCSV(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	rows, err := handler.habits.ExportLogs(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to export habits"})
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="habits.csv"`)

	writer := csv.NewWriter(c.Writer)
	writer.Write([]string{"date", "habit_name", "category", "value", "unit"})
	for _, row := range rows {
		unit := ""
		if row.TargetUnit != nil {
			unit = *row.TargetUnit
		}
		writer.Write([]string{row.Date, row.HabitName, row.Category, formatFloat(row.Value), unit})
	}
	writer.Flush()
}

func (handler HabitHandler) ListCategories(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	categories, err := handler.habits.ListCategories(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list habit categories"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

func (handler HabitHandler) CreateCategory(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request habitCategoryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category request"})
		return
	}

	category, err := handler.habits.CreateCategory(c.Request.Context(), services.CreateHabitCategoryInput{UserID: userID, Name: request.Name})
	if err != nil {
		writeHabitError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"category": category})
}

func (handler HabitHandler) UpdateCategory(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request habitCategoryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category request"})
		return
	}

	category, err := handler.habits.UpdateCategory(c.Request.Context(), services.UpdateHabitCategoryInput{
		UserID: userID,
		ID:     c.Param("id"),
		Name:   request.Name,
	})
	if err != nil {
		writeHabitError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"category": category})
}

func (handler HabitHandler) DeleteCategory(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	if err := handler.habits.DeleteCategory(c.Request.Context(), userID, c.Param("id")); err != nil {
		writeHabitError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (handler HabitHandler) ListHabits(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	habits, err := handler.habits.ListHabits(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list habits"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"habits": habits})
}

func (handler HabitHandler) CreateHabit(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request habitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid habit request"})
		return
	}

	habit, err := handler.habits.CreateHabit(c.Request.Context(), services.CreateHabitInput{
		UserID:        userID,
		CategoryID:    request.CategoryID,
		Name:          request.Name,
		Description:   request.Description,
		Type:          request.Type,
		TargetValue:   request.TargetValue,
		TargetUnit:    request.TargetUnit,
		FrequencyType: request.FrequencyType,
		FrequencyDays: request.FrequencyDays,
		WeeklyGoal:    request.WeeklyGoal,
		SortOrder:     request.SortOrder,
	})
	if err != nil {
		writeHabitError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"habit": habit})
}

func (handler HabitHandler) UpdateHabit(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request updateHabitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid habit request"})
		return
	}

	habit, err := handler.habits.UpdateHabit(c.Request.Context(), services.UpdateHabitInput{
		UserID:        userID,
		ID:            c.Param("id"),
		CategoryID:    request.CategoryID,
		Name:          request.Name,
		Description:   request.Description,
		Type:          request.Type,
		TargetValue:   request.TargetValue,
		TargetUnit:    request.TargetUnit,
		FrequencyType: request.FrequencyType,
		FrequencyDays: request.FrequencyDays,
		WeeklyGoal:    request.WeeklyGoal,
		SortOrder:     request.SortOrder,
	})
	if err != nil {
		writeHabitError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"habit": habit})
}

func (handler HabitHandler) DeleteHabit(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	if err := handler.habits.DeleteHabit(c.Request.Context(), userID, c.Param("id")); err != nil {
		writeHabitError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (handler HabitHandler) LogHabit(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request habitLogRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid habit log request"})
		return
	}
	if request.LoggedDate == "" {
		request.LoggedDate = time.Now().Format("2006-01-02")
	}

	log, err := handler.habits.LogHabit(c.Request.Context(), services.LogHabitInput{
		UserID:     userID,
		HabitID:    c.Param("id"),
		LoggedDate: request.LoggedDate,
		Value:      request.Value,
		Note:       request.Note,
	})
	if err != nil {
		writeHabitError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"log": log})
}

func (handler HabitHandler) Analytics(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	analytics, err := handler.habits.Analytics(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		writeHabitError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"analytics": analytics})
}

func formatFloat(value float64) string {
	return fmt.Sprintf("%g", value)
}

func writeHabitError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, models.ErrNotFound) {
		status = http.StatusNotFound
	}
	c.JSON(status, gin.H{"error": err.Error()})
}
