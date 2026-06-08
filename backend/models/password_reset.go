package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PasswordResetToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"created_at"`
}

type PasswordResetTokenModel struct {
	pool *pgxpool.Pool
}

func NewPasswordResetTokenModel(pool *pgxpool.Pool) PasswordResetTokenModel {
	return PasswordResetTokenModel{pool: pool}
}

func (model PasswordResetTokenModel) Create(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) (PasswordResetToken, error) {
	var token PasswordResetToken
	err := model.pool.QueryRow(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, token_hash, expires_at, used, created_at
	`, userID, tokenHash, expiresAt).Scan(
		&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &token.Used, &token.CreatedAt,
	)
	return token, err
}

func (model PasswordResetTokenModel) GetByHash(ctx context.Context, tokenHash string) (PasswordResetToken, error) {
	var token PasswordResetToken
	err := model.pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, used, created_at
		FROM password_reset_tokens
		WHERE token_hash = $1
	`, tokenHash).Scan(
		&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &token.Used, &token.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return PasswordResetToken{}, ErrNotFound
	}
	return token, err
}

func (model PasswordResetTokenModel) MarkUsed(ctx context.Context, id string) error {
	_, err := model.pool.Exec(ctx, "UPDATE password_reset_tokens SET used = TRUE WHERE id = $1", id)
	return err
}

func (model PasswordResetTokenModel) RevokeByUserID(ctx context.Context, userID string) error {
	_, err := model.pool.Exec(ctx, "DELETE FROM password_reset_tokens WHERE user_id = $1", userID)
	return err
}
