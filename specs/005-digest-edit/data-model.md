# Data Model: 登録済みの Digest を編集する

テーブルと制約は変えない (migration なし)。使う制約は既存のもの。

| 制約 | 本機能での役割 |
|---|---|
| `digests_created_by_entry_date_key` UNIQUE (created_by, entry_date) | 日付変更の衝突 → 400 `digest-already-exists` (FR-009) |
| `articles_created_by_url_key` UNIQUE (created_by, url) | 他の Digest に登録済みの URL の最終防衛線 (FR-008) |
| `articles.digest_id` FK `ON DELETE CASCADE` / `article_links` FK `ON DELETE CASCADE` | 記事の全削除で親子のつながりも消える (research R1) |

## クエリ (`backend/db/queries/digests.sql` に追加)

| 名前 | 内容 |
|---|---|
| `ListDigests :many` | `SELECT id, entry_date FROM digests ORDER BY entry_date DESC, created_at DESC` |
| `GetDigestByDate :one` | `SELECT * FROM digests WHERE entry_date = $1 ORDER BY created_at DESC LIMIT 1` |
| `UpdateDigestDate :one` | `UPDATE digests SET entry_date = sqlc.arg(new_date) WHERE created_by = $1 AND entry_date = sqlc.arg(old_date) RETURNING *` (0 行 → 404) |
| `DeleteArticlesByDigest :exec` | `DELETE FROM articles WHERE digest_id = $1` |

`CreateArticle` / `CreateArticleLink` / `ListRegisteredURLs` / `ListArticlesByDigest` / `ListArticleLinksByDigest` は既存のまま使う。

## 保存の手順 (`PUT /digests/{entryDate}`、1 トランザクション)

1. `UpdateDigestDate` — 0 行なら 404。UNIQUE 違反なら `constraintViolation` が `digest-already-exists`
2. `DeleteArticlesByDigest`
3. `ListRegisteredURLs` — 自分の記事は削除済みなので判定から外れる (research R2)。1 件でもあれば `url-already-registered`
4. 記事と親子の挿入 — `CreateDigest` の挿入部分を関数に切り出して共用する
5. commit。応答は `toDigest`

## frontend の型

| 型 | 置き場所 | 内容 |
|---|---|---|
| `digestSummary` (zod) | `shared/api/schemas.ts` | `{ id: digestId, entryDate: string }`。`satisfies z.ZodType<Schemas["DigestSummary"]>` |
| `digestList` (zod) | 同上 | `{ items: digestSummary[] }` |
| `Board` の初期値 | `pages/digest-new/model/board.ts` の `fromDigest` | 保存済みの記事を `category` の箱へ順に入れる。`status: "done"`、`initial` は保存済みの `url` / `title`、未分類は空 |

`toNewDigest(fromDigest(d), d.entryDate)` は、保存済みの Digest `d` の送信データ (カテゴリ・順序・hot・タイトル・URL・子の順) と一致する。これが SC-002 の根拠で、Vitest で確かめる。
