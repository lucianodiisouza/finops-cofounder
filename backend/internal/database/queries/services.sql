-- name: CreateService :one
INSERT INTO services (project_id, name, category, amount_cents, currency, billing_cycle, starts_on, ends_on, notes)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
FROM projects p
WHERE p.id = $1 AND p.user_id = sqlc.arg(user_id)
RETURNING *;

-- name: UpdateService :one
UPDATE services s
SET name = $3, category = $4, amount_cents = $5, currency = $6,
    billing_cycle = $7, starts_on = $8, ends_on = $9, notes = $10, updated_at = now()
WHERE s.id = $1
  AND EXISTS (SELECT 1 FROM projects p WHERE p.id = s.project_id AND p.user_id = $2)
RETURNING s.*;

-- name: DeleteService :execrows
DELETE FROM services s
WHERE s.id = $1
  AND EXISTS (SELECT 1 FROM projects p WHERE p.id = s.project_id AND p.user_id = $2);

-- name: ListServicesForUser :many
SELECT s.*, p.name AS project_name, p.color AS project_color, p.archived_at AS project_archived_at
FROM services s
JOIN projects p ON p.id = s.project_id
WHERE p.user_id = $1
ORDER BY p.name, s.name;

-- name: ListServicesByProject :many
SELECT s.* FROM services s
JOIN projects p ON p.id = s.project_id
WHERE p.user_id = $1 AND s.project_id = $2
ORDER BY s.name;
