-- 1 回の登録 = 1 digest。同じ日付を再登録しても別行にし、読む側は最新の 1 件だけ返す (specs/002 Edge Cases)
CREATE TABLE digests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    digest_id uuid NOT NULL REFERENCES digests (id) ON DELETE CASCADE,
    position integer NOT NULL,
    -- 固定 7 カテゴリ (specs/001 FR-007)。表示順はアプリ側の定数で決める
    category text NOT NULL CHECK (category IN ('セキュリティ', 'ホットトピック', 'IT系', 'UI系', 'AI系', '面白そうなツール・サービス', 'その他')),
    title text NOT NULL CHECK (title <> ''),
    url text NOT NULL CHECK (url <> ''),
    description text,
    UNIQUE (digest_id, position),
    -- 同じ digest 内で URL は完全一致で重複させない (specs/001 FR-005)。digest をまたいだ重複は許す (specs/002 Edge Cases)
    UNIQUE (digest_id, url)
);
