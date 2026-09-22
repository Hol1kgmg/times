-- name: ListItems :many
SELECT * FROM items ORDER BY created_at DESC, id;

-- name: CreateItem :one
INSERT INTO items (title) VALUES ($1) RETURNING *;
