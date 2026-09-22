-- name: ListItems :many
-- ponytail: 無制限。件数が増えたらカーソル (created_at, id) で LIMIT する (adr/backend/0004)
SELECT * FROM items ORDER BY created_at DESC, id;

-- name: CreateItem :one
INSERT INTO items (title) VALUES ($1) RETURNING *;

-- name: GetItem :one
SELECT * FROM items WHERE id = $1;
