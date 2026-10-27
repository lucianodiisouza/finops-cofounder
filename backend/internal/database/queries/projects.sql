-- name: CreateProject :one
INSERT INTO projects (user_id, name, description, color)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListProjects :many
SELECT * FROM projects
WHERE user_id = $1
ORDER BY archived_at NULLS FIRST, name;

-- name: GetProject :one
SELECT * FROM projects WHERE id = $1 AND user_id = $2;

-- name: UpdateProject :one
UPDATE projects
SET name = $3, description = $4, color = $5, updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: SetProjectArchived :one
UPDATE projects
SET archived_at = CASE WHEN sqlc.arg(archived)::boolean THEN now() ELSE NULL END,
    updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteProject :execrows
DELETE FROM projects WHERE id = $1 AND user_id = $2;
