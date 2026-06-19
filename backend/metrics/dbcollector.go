package metrics

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartDBStatsCollector(pool *pgxpool.Pool) {
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			stats := pool.Stat()
			DbPoolAcquiredConns.Set(float64(stats.AcquiredConns()))
			DbPoolIdleConns.Set(float64(stats.IdleConns()))
			DbPoolTotalConns.Set(float64(stats.TotalConns()))
		}
	}()
}
