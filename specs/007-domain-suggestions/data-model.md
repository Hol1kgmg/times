# Data Model: ドメイン候補

## 保存するもの

なし。migration は足さない。読むのは既存の `articles.url` と、公開分の絞り込みに使う `digests.status` だけ (親記事・子記事とも `articles` の行なので FR-008 は追加の結合なしで満たす)。

## ドメイン候補 (求める値)

| 項目 | 型 | 求め方 |
|---|---|---|
| host | text, 空でない | `substring(url from '^https?://([^/:?#]+)')`。ポート・パス・クエリ・フラグメントの手前まで。大文字小文字は URL のまま |
| count | integer, 1 以上 | その host を持つ `articles` の行数 |

- 並び: `count DESC, host ASC` (FR-002)
- 絞り込み: `q` が NULL か空文字なら全件、それ以外は `strpos(lower(host), lower(q)) > 0` (FR-003, R2)
- 全件 (`published_only = false`) は Digest の `status` を見ない (FR-006)。公開分 (`published_only = true`) は `status = 'published'` の Digest の記事だけ (FR-010)
- `created_by` は見ない (管理者 1 人の前提。`ponytail:` コメントを残す)

## クエリ (`backend/db/queries/articles.sql`)

```sql
-- name: ListArticleDomains :many
SELECT host, count(*)::int AS count
FROM (
    SELECT substring(a.url from '^https?://([^/:?#]+)')::text AS host
    FROM articles a JOIN digests d ON d.id = a.digest_id
    WHERE NOT sqlc.arg(published_only)::bool OR d.status = 'published'
) x
WHERE sqlc.narg(q)::text IS NULL OR strpos(lower(host), lower(sqlc.narg(q))) > 0
GROUP BY host ORDER BY count DESC, host LIMIT sqlc.arg(lim);
```

空文字の `q` は NULL と同じに扱う。`strpos(x, '')` は 1 を返すので、そのままでも全件になる。

## frontend の型 (`frontend/src/shared/api/schemas.ts`)

| スキーマ | 形 | 縛り |
|---|---|---|
| `domainCount` | `{ host: string (min 1), count: number (int, min 1) }` | `satisfies z.ZodType<Schemas["DomainCount"]>` |
| `domainList` | `{ domains: domainCount[] }` | `satisfies z.ZodType<Schemas["DomainList"]>` |

サーバー関数 `listArticleDomains` (公開分) と `listAllArticleDomains` (全件) の入力は同じ: `z.object({ q: z.string().max(100).optional(), limit: z.number().int().min(1).max(50).optional() })`
