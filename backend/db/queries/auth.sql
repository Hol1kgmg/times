-- name: UpsertUser :one
-- 初回は作成、2 回目以降は login の最新値と最終ログインを更新する
INSERT INTO users (id, login) VALUES ($1, $2)
ON CONFLICT (id) DO UPDATE SET login = EXCLUDED.login, updated_at = now()
RETURNING *;

-- name: CreateSession :one
INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3) RETURNING *;

-- name: GetSessionByTokenHash :one
-- 期限切れの行が残っていても無効 (specs/003 Assumptions)
SELECT sessions.*, users.login FROM sessions
JOIN users ON users.id = sessions.user_id
WHERE token_hash = $1 AND expires_at > now();

-- name: DeleteSessionByTokenHash :exec
-- 0 行でもエラーにしない (ログアウトの冪等性)
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at < now();
