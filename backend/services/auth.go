package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"commit/backend/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	users         models.UserModel
	refreshTokens models.RefreshTokenModel
	habits        HabitService
	resetTokens   models.PasswordResetTokenModel
	email         EmailSender
	appURL        string
	jwtSecret     []byte
	jwtExpiryDur  time.Duration
	jwtExpiryMinutes int
}

type AuthClaims struct {
	UserID string          `json:"user_id"`
	Role   models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

type RegisterInput struct {
	Email    string
	Password string
	Name     string
}

type LoginInput struct {
	Email    string
	Password string
}

type AuthResult struct {
	User         models.User
	Token        string
	RefreshToken string
}

var ErrInvalidCredentials = errors.New("invalid credentials")

func NewAuthService(users models.UserModel, refreshTokens models.RefreshTokenModel, resetTokens models.PasswordResetTokenModel, email EmailSender, appURL string, habits HabitService, jwtSecret string, jwtExpiryHours int, jwtExpiryMinutes int) AuthService {
	return AuthService{
		users:         users,
		refreshTokens: refreshTokens,
		resetTokens:   resetTokens,
		email:         email,
		appURL:        appURL,
		habits:        habits,
		jwtSecret:     []byte(jwtSecret),
		jwtExpiryDur:  time.Duration(jwtExpiryHours) * time.Hour,
		jwtExpiryMinutes: jwtExpiryMinutes,
	}
}

func (service AuthService) Register(ctx context.Context, input RegisterInput) (AuthResult, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	name := strings.TrimSpace(input.Name)
	if email == "" || name == "" || len(input.Password) < 8 {
		return AuthResult{}, fmt.Errorf("email, name, and password with at least 8 characters are required")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResult{}, err
	}

	user, err := service.users.Create(ctx, models.CreateUserParams{
		Email:        email,
		PasswordHash: string(passwordHash),
		Name:         name,
		Role:         models.RoleUser,
	})
	if err != nil {
		return AuthResult{}, err
	}

	cleanup := true
	defer func() {
		if cleanup {
			service.users.Delete(ctx, user.ID)
		}
	}()

	if err := service.habits.SeedDefaults(ctx, user.ID); err != nil {
		return AuthResult{}, err
	}

	token, refreshToken, err := service.signTokens(ctx, user)
	if err != nil {
		return AuthResult{}, err
	}

	cleanup = false
	return AuthResult{User: user, Token: token, RefreshToken: refreshToken}, nil
}

func (service AuthService) Login(ctx context.Context, input LoginInput) (AuthResult, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	user, err := service.users.GetByEmail(ctx, email)
	if err != nil {
		return AuthResult{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return AuthResult{}, ErrInvalidCredentials
	}

	token, refreshToken, err := service.signTokens(ctx, user)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{User: user, Token: token, RefreshToken: refreshToken}, nil
}

func (service AuthService) CurrentUser(ctx context.Context, userID string) (models.User, error) {
	return service.users.GetByID(ctx, userID)
}

func (service AuthService) ParseToken(tokenText string) (AuthClaims, error) {
	claims := AuthClaims{}
	token, err := jwt.ParseWithClaims(tokenText, &claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return service.jwtSecret, nil
	})
	if err != nil {
		return AuthClaims{}, err
	}
	if !token.Valid {
		return AuthClaims{}, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func (service AuthService) RefreshAccessToken(ctx context.Context, refreshTokenText string) (string, string, error) {
	tokenHash := hashToken(refreshTokenText)
	stored, err := service.refreshTokens.GetByHash(ctx, tokenHash)
	if err != nil {
		return "", "", fmt.Errorf("invalid refresh token")
	}

	if time.Now().After(stored.ExpiresAt) {
		service.refreshTokens.Delete(ctx, stored.ID)
		return "", "", fmt.Errorf("refresh token expired")
	}

	if err := service.refreshTokens.Delete(ctx, stored.ID); err != nil {
		return "", "", err
	}

	user, err := service.users.GetByID(ctx, stored.UserID)
	if err != nil {
		return "", "", err
	}

	newToken, newRefreshRaw, err := service.signTokens(ctx, user)
	if err != nil {
		return "", "", err
	}

	return newToken, newRefreshRaw, nil
}

func (service AuthService) RevokeRefreshTokens(ctx context.Context, userID string) error {
	return service.refreshTokens.DeleteByUserID(ctx, userID)
}

func (service AuthService) ForgotPassword(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return fmt.Errorf("email is required")
	}

	user, err := service.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil
		}
		return err
	}

	rawToken, err := generateRandomToken()
	if err != nil {
		return err
	}

	hashed := hashToken(rawToken)
	if _, err := service.resetTokens.Create(ctx, user.ID, hashed, time.Now().Add(1*time.Hour)); err != nil {
		return err
	}

	resetURL := service.appURL + "/reset-password?token=" + rawToken

	if err := service.email.SendPasswordReset(user.Email, resetURL); err != nil {
		return err
	}

	return nil
}

func (service AuthService) ResetPassword(ctx context.Context, token string, newPassword string) error {
	if len(newPassword) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	hashed := hashToken(token)
	resetToken, err := service.resetTokens.GetByHash(ctx, hashed)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return fmt.Errorf("invalid or expired reset token")
		}
		return err
	}

	if resetToken.Used {
		return fmt.Errorf("reset token has already been used")
	}

	if time.Now().After(resetToken.ExpiresAt) {
		return fmt.Errorf("reset token has expired")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if err := service.users.UpdatePassword(ctx, resetToken.UserID, string(passwordHash)); err != nil {
		return err
	}

	if err := service.resetTokens.MarkUsed(ctx, resetToken.ID); err != nil {
		return err
	}

	return service.refreshTokens.DeleteByUserID(ctx, resetToken.UserID)
}

func (service AuthService) signTokens(ctx context.Context, user models.User) (string, string, error) {
	accessToken, err := service.signAccessToken(user)
	if err != nil {
		return "", "", err
	}

	refreshRaw, err := generateRandomToken()
	if err != nil {
		return "", "", err
	}

	refreshHash := hashToken(refreshRaw)
	refreshExpiry := time.Now().Add(service.jwtExpiryDur)

	if _, err := service.refreshTokens.Create(ctx, models.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: refreshExpiry,
	}); err != nil {
		return "", "", err
	}

	return accessToken, refreshRaw, nil
}

func (service AuthService) signAccessToken(user models.User) (string, error) {
	claims := AuthClaims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(service.jwtExpiryMinutes) * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(service.jwtSecret)
}

func generateRandomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
