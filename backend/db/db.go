package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PoolConfig struct {
	MaxConns        int
	MinConns        int
	MaxLifetimeMin  int
	MaxIdleMin      int
}

func Connect(ctx context.Context, databaseURL string, poolCfg PoolConfig) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	config.MaxConns = int32(poolCfg.MaxConns)
	config.MinConns = int32(poolCfg.MinConns)
	config.MaxConnLifetime = time.Duration(poolCfg.MaxLifetimeMin) * time.Minute
	config.MaxConnIdleTime = time.Duration(poolCfg.MaxIdleMin) * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}
