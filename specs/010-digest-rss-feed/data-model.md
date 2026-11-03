# Data Model: Digest の公開を知らせる RSS フィード

## digests (変更)

| 列 | 型 | 制約 | 意味 |
|---|---|---|---|
| `published_at` | `timestamptz` | NULL 可。`CHECK (status <> 'draft' OR published_at IS NULL)` | 公開で登録した時刻、または下書きから公開にした時刻。一度入ったら変えない |

マイグレーション `000011_digest_published_at`。既存行は NULL のまま (spec FR-008)。

### 状態遷移と published_at

| 操作 | 前の status | 後の status | published_at |
|---|---|---|---|
| 登録 | — | draft / private | NULL |
| 登録 | — | published | `now()` |
| 編集 | draft | published | `now()` |
| 編集 | private | published | 変えない (下書きから非公開にしたものは NULL のまま) |
| 編集 | その他 | その他 | 変えない |

### 業務ルール (handler)

- 書き込み後の行が `status = 'published'` かつ `entry_date > 今日 (JST)` なら `/problems/future-publish` (400)。トランザクションごと巻き戻す。

## フィードの項目 (派生、保存しない)

`status = 'published' AND published_at IS NOT NULL AND 管理者が作成` の Digest を `published_at DESC` で 20 件。

| 項目 | 元 |
|---|---|
| guid | `urn:uuid:` + `digests.id` |
| title | `entry_date` を `1月2日(火)` の形にしたもの + `の times 投稿が公開されました` |
| pubDate | `published_at` |
| 画像 | `/feed/images/<entry_date>.png` |

## sqlc クエリ (追加・変更)

- `CreateDigest` (変更): `published_at` を status から決める
- `UpdateDigest` (変更): `published_at` を遷移から決める
- `ListFeedDigests` (追加): フィードの対象を 20 件
- `GetFeedDigestByDate` (追加): 画像の対象かどうか (同じ条件 + `entry_date = $1`)
