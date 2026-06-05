package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"commit/backend/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	users     models.UserModel
	jwtSecret []byte
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
	User  models.User
	Token string
}

var ErrInvalidCredentials = errors.New("invalid credentials")

func NewAuthService(users models.UserModel, jwtSecret string) AuthService {
	return AuthService{users: users, jwtSecret: []byte(jwtSecret)}
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

	token, err := service.signToken(user)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{User: user, Token: token}, nil
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

	token, err := service.signToken(user)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{User: user, Token: token}, nil
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

func (service AuthService) signToken(user models.User) (string, error) {
	claims := AuthClaims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(service.jwtSecret)
}
