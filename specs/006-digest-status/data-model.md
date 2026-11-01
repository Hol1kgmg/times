# Data Model: Digest の公開ステータス

## digests (migration `000010_digest_status`)

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| status | text | NOT NULL, CHECK (status IN ('draft', 'published', 'private')) | 追加時だけ `DEFAULT 'published'` で既存行を埋め、直後に `DROP DEFAULT` (research R1) |

down は `DROP COLUMN status`。

## 状態の移り方

| 今 \ 次 | draft | published | private |
|---|---|---|---|
| (作成) | ○ | ○ | × |
| draft | (省略) | ○ | ○ |
| published | × | (省略) | ○ |
| private | × | ○ | (省略) |

- 作成で取れるのは `draft` / `published`。更新で取れるのは `published` / `private` (省略時は今のまま)。
- `draft` へ入る経路は作成だけ。スキーマが更新で `draft` を受けないので、戻る経路はない (research R2)。

## クエリ (`db/queries/digests.sql`)

| クエリ | 変更 |
|---|---|
| `GetLatestDigest` | `WHERE status = 'published'` を足す |
| `ListDigests` | `status` を SELECT に足す |
| `GetDigestByDate` | 変更なし (`SELECT *` で `status` も返る) |
| `CreateDigest` | `status` を引数に足す |
| `UpdateDigestDate` → `UpdateDigest` | `status = COALESCE(sqlc.narg(status), status)` を足す |

## frontend の型 (`shared/api/schemas.ts`)

| スキーマ | 内容 |
|---|---|
| `digestStatus` | `z.enum(["draft", "published", "private"])` `satisfies` `Schemas["DigestStatus"]` |
| `digest` / `digestSummary` | `status: digestStatus` を足す |
| `newDigest` | `status: digestStatus.extract(["draft", "published"]).default("draft")` を足す (`hot` と同じく、`default` で生成型が必須になるため) |
| `digestUpdate` | `newDigest.omit({ status }).extend({ status: digestStatus.extract(["published", "private"]).optional() })` `satisfies` `Schemas["DigestUpdate"]` |
