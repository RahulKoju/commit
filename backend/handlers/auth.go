package handlers

import (
	"errors"
	"net/http"

	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

const (
	accessCookieName  = "access_token"
	refreshCookieName = "refresh_token"
)

type AuthHandler struct {
	auth         services.AuthService
	cookieDomain string
}

type registerRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type authResponse struct {
	User models.User `json:"user"`
}

func NewAuthHandler(auth services.AuthService, cookieDomain string) AuthHandler {
	return AuthHandler{auth: auth, cookieDomain: cookieDomain}
}

func (handler AuthHandler) Register(c *gin.Context) {
	var request registerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid register request"})
		return
	}

	result, err := handler.auth.Register(c.Request.Context(), services.RegisterInput{
		Email:    request.Email,
		Password: request.Password,
		Name:     request.Name,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	setAuthCookies(c, result.Token, result.RefreshToken, handler.cookieDomain)
	c.JSON(http.StatusCreated, authResponse{User: result.User})
}

func (handler AuthHandler) Login(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid login request"})
		return
	}

	result, err := handler.auth.Login(c.Request.Context(), services.LoginInput{
		Email:    request.Email,
		Password: request.Password,
	})
	if err != nil {
		status := http.StatusInternalServerError
		message := "login failed"
		if errors.Is(err, services.ErrInvalidCredentials) {
			status = http.StatusUnauthorized
			message = "invalid email or password"
		}
		c.JSON(status, gin.H{"error": message})
		return
	}

	setAuthCookies(c, result.Token, result.RefreshToken, handler.cookieDomain)
	c.JSON(http.StatusOK, authResponse{User: result.User})
}

func (handler AuthHandler) Refresh(c *gin.Context) {
	refreshCookie, err := c.Cookie(refreshCookieName)
	if err != nil || refreshCookie == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token required"})
		return
	}

	newToken, newRefreshToken, err := handler.auth.RefreshAccessToken(c.Request.Context(), refreshCookie)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	setAuthCookies(c, newToken, newRefreshToken, handler.cookieDomain)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (handler AuthHandler) Logout(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if refreshCookie, err := c.Cookie(refreshCookieName); err == nil && refreshCookie != "" {
		handler.auth.Logout(c.Request.Context(), refreshCookie, userID)
	} else if ok {
		handler.auth.RevokeRefreshTokens(c.Request.Context(), userID)
	}
	clearAuthCookies(c, handler.cookieDomain)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (handler AuthHandler) Me(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	user, err := handler.auth.CurrentUser(c.Request.Context(), userID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, authResponse{User: user})
}

type forgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type resetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func (handler AuthHandler) ForgotPassword(c *gin.Context) {
	var request forgotPasswordRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid email is required"})
		return
	}

	if err := handler.auth.ForgotPassword(c.Request.Context(), request.Email); err != nil {
		writeServerError(c, "password reset failed", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "if that email exists, a reset link has been sent"})
}

func (handler AuthHandler) ResetPassword(c *gin.Context) {
	var request resetPasswordRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token and new password (min 8 chars) are required"})
		return
	}

	if err := handler.auth.ResetPassword(c.Request.Context(), request.Token, request.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password has been reset successfully"})
}

func setAuthCookies(c *gin.Context, accessToken string, refreshToken string, domain string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     accessCookieName,
		Value:    accessToken,
		Domain:   domain,
		Path:     "/",
		MaxAge:   86400, // 1 day
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.Request.TLS != nil,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    refreshToken,
		Domain:   domain,
		Path:     "/api/v1/auth/refresh",
		MaxAge:   7 * 24 * 3600, // 7 days
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.Request.TLS != nil,
	})
}

func clearAuthCookies(c *gin.Context, domain string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     accessCookieName,
		Value:    "",
		Domain:   domain,
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.Request.TLS != nil,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Domain:   domain,
		Path:     "/api/v1/auth/refresh",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.Request.TLS != nil,
	})
}


