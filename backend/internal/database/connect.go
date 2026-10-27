package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect abre o pool de conexões com retry exponencial (1s, 2s, 4s, 8s, 16s, 32s).
// O retry cobre o caso de o banco ainda estar subindo em paralelo com a aplicação.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error
	for i := range 6 {
		pool, err = pgxpool.New(ctx, databaseURL)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return pool, nil
			}
			pool.Close()
		}
		delay := time.Second * (1 << i)
		slog.Warn("banco não está pronto, tentando de novo", "attempt", i+1, "delay", delay, "err", err)
		time.Sleep(delay)
	}
	return nil, fmt.Errorf("não foi possível conectar ao banco: %w", err)
}
