package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RefreshToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateRefreshTokenParams struct {
	UserID    string
	TokenHash string
	ExpiresAt time.Time
}

type RefreshTokenModel struct {
	pool *pgxpool.Pool
}

func NewRefreshTokenModel(pool *pgxpool.Pool) RefreshTokenModel {
	return RefreshTokenModel{pool: pool}
}

func (model RefreshTokenModel) Create(ctx context.Context, params CreateRefreshTokenParams) (RefreshToken, error) {
	var token RefreshToken
	err := model.pool.QueryRow(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, token_hash, expires_at, created_at
	`, params.UserID, params.TokenHash, params.ExpiresAt).Scan(
		&token.ID,
		&token.UserID,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.CreatedAt,
	)
	return token, err
}

func (model RefreshTokenModel) GetByHash(ctx context.Context, tokenHash string) (RefreshToken, error) {
	var token RefreshToken
	err := model.pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`, tokenHash).Scan(
		&token.ID,
		&token.UserID,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return RefreshToken{}, ErrNotFound
	}
	return token, err
}

func (model RefreshTokenModel) Delete(ctx context.Context, id string) error {
	_, err := model.pool.Exec(ctx, "DELETE FROM refresh_tokens WHERE id = $1", id)
	return err
}

func (model RefreshTokenModel) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := model.pool.Exec(ctx, "DELETE FROM refresh_tokens WHERE user_id = $1", userID)
	return err
}
