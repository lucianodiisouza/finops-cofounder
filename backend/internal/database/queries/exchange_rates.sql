-- name: UpsertExchangeRate :one
INSERT INTO exchange_rates (user_id, currency, month, rate_e8)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, currency, month)
DO UPDATE SET rate_e8 = EXCLUDED.rate_e8, updated_at = now()
RETURNING *;

-- name: ListExchangeRates :many
SELECT * FROM exchange_rates
WHERE user_id = $1
ORDER BY month DESC, currency;

-- name: DeleteExchangeRate :execrows
DELETE FROM exchange_rates WHERE id = $1 AND user_id = $2;
