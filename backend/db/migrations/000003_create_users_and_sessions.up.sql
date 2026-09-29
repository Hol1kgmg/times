-- 管理者の記録。行がある = 過去にログインが成立した管理者。ロール列は持たない (specs/003 data-model)
CREATE TABLE users (
    -- GitHub 固定 ID。ユーザー名を識別子にしない (specs/003 FR-011)
    id bigint PRIMARY KEY,
    login text NOT NULL CHECK (login <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ログイン状態。平文トークンは保存しない
CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash bytea NOT NULL UNIQUE,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- created_at + 30 days。延長しない (specs/003 FR-007)
    expires_at timestamptz NOT NULL
);
-- ponytail: 管理者 1 人。複数になったら user_id に索引
