# Data Model: Digest のタイムライン

## 保存するもの

なし。migration は足さない。読むのは既存の `digests` (`status`・`entry_date`・`created_by`)、`users` (`id`・`login`)、記事は既存の `ListArticlesByDigest` / `ListArticleLinksByDigest` で読む。

## 頼る既存の制約

| 制約 | 定義 | この機能での意味 |
|---|---|---|
| `UNIQUE (created_by, entry_date)` | migration 000008 | 管理者に絞ると日付が一意になり、`before` だけで続きが決まる (R3) |
| `digests.created_by NOT NULL REFERENCES users (id)` | migration 000007 | 作成者は必ず `users` の行を持つ |
| `users.login CHECK (login <> '')` | migration 000003 | 管理者が未設定 (`adminLogin = ''`) なら一致する行がない (R2) |
| `digests.status CHECK (... 'published' ...)` | migration 000010 | 公開だけを返す (FR-008) |

DB が保証しないもの: 管理者が 1 アカウントだけであること、`users.login` の重複がないこと (spec Assumptions)。

## タイムラインの 1 ページ (求める値)

| 項目 | 求め方 |
|---|---|
| 対象 | `status = 'published'` かつ作成者の `lower(login)` が `lower(adminLogin)` と一致 (FR-008, FR-010) |
| 範囲 | `before` が NULL なら全件、それ以外は `entry_date < before` (FR-005) |
| 並び | `entry_date DESC` (FR-002) |
| 件数 | `LIMIT lim`。Digest の件数で数える (FR-003) |
| 各 Digest の中身 | 既存の `withArticles` → `toDigest`。記事は `position` 順 (FR-004, FR-007) |

## クエリ (`backend/db/queries/digests.sql`)

```sql
-- name: ListPublishedDigests :many
-- ponytail: 管理者はユーザー名で判定する。同じ login の行が 2 つあれば混ざる (spec Assumptions)
SELECT * FROM digests
WHERE status = 'published'
  AND created_by IN (SELECT id FROM users WHERE lower(login) = lower(sqlc.arg(admin_login)))
  AND (sqlc.narg(before)::date IS NULL OR entry_date < sqlc.narg(before))
ORDER BY entry_date DESC LIMIT sqlc.arg(lim);
```

`SELECT *` で `db.Digest` が返るので、`withArticles` にそのまま渡せる。

## frontend の型 (`frontend/src/shared/api/schemas.ts`)

| スキーマ | 形 | 縛り |
|---|---|---|
| `digestPage` | `{ digests: digest[] }` (既存の `digest` を使う) | `satisfies z.ZodType<Schemas["DigestPage"]>` |
