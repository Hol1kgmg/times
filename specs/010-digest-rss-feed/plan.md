# Implementation Plan: Digest の公開を知らせる RSS フィード

**Branch**: `010-digest-rss-feed` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-digest-rss-feed/spec.md`

## Summary

`digests.published_at` を足し、公開で登録したときと下書きから公開にしたときだけ SQL の中で記録する。backend の `GET /feed` は `published_at` を持つ公開の Digest を新しい順に 20 件、RSS 2.0 で返す。`GET /feed/images/{entryDate}` は、事前に作った下地 PNG に日付を描いた画像を返す。frontend の server route `/feed.xml` と `/feed/images/<日付>.png` が、この 2 つを Cache API 越しに中継して公開する。通知のリンク先は日ごとのページ `/digest/<日付>` で、SNS とリーダーには専用画像を示し、人はトップへ送る。フィードに載らない日付は、キャッシュ済みのフィードで判定して backend に届けずに 404 にし、既存の WAF のレート制限を `/feed` と `/digest/` にも広げる。あわせて、未来の日付 (JST) で公開になる書き込みを handler で `/problems/future-publish` として断り、編集画面の日付欄に出す。

## Technical Context

**Language/Version**: Go 1.26 (backend)、TypeScript strict / React 19 (frontend)

**Primary Dependencies**: 既存 (Gin + oapi-codegen strict、sqlc + pgx v5、TanStack Start)。新規は `golang.org/x/image` だけ (opentype のフォント描画)

**Storage**: PostgreSQL 18。`digests.published_at` を追加 (migration 000011)

**Testing**: go test (unit + router)、Vitest、Playwright (既存の `digest-new` / `digest-edit` を回す。新しい e2e は足さない)

**Target Platform**: backend は Cloud Run (distroless)、frontend は Cloudflare Workers

**Project Type**: web-service (backend) + web (frontend)

**Performance Goals**: フィードと画像は Cache API で吸収する。backend の負荷はキャッシュの切れ目に 1 回ずつ

**Constraints**: backend はブラウザに公開しない (adr/backend/0003)。Workers のバンドルに重い依存を入れない

**Scale/Scope**: 管理者 1 名、購読者は少数。フィード 20 件

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec 承認済み。本 plan の承認後に tasks → implement |
| II. 契約ファースト | ✅ | 2 操作と problem type を `openapi.yaml` に足し、strict server の interface を実装する。SQL は sqlc。エラーは Problem Details。フィードは一覧応答ではなく RSS なので `{items}` で包む規約の対象外 |
| III. サーバー関数経由のみ | ✅ | ブラウザ・リーダーが叩くのは frontend の server route だけ。backend は `X-Backend-Token` で守ったまま。route の入力 (画像のファイル名) は zod で検証 |
| IV. 最小実装 | ✅ (1 件記録) | 依存の追加 1 件を Complexity Tracking に記す。画像のレイアウトは既存の `og-image.ts` に寄せ、Go は文字を 1 行描くだけ |
| V. テストとスキーマ | ✅ | FR-001/002 は SQL + CHECK、FR-003/004/009/010 は openapi + Go の変換関数のテスト、FR-006 は handler の判定関数のテスト + Problem type、FR-007 は `rejectionOf` の Vitest |

Phase 1 後の再確認: 変化なし。

## 設計

### backend

| ファイル | 変更 |
|---|---|
| `db/migrations/000011_digest_published_at.{up,down}.sql` | 列と CHECK (data-model.md) |
| `db/queries/digests.sql` | `CreateDigest` / `UpdateDigest` で `published_at` を決める。`ListFeedDigests`、`GetFeedDigestByDate` を追加 |
| `api/openapi.yaml` | `getFeed`、`getFeedImage`、`/problems/future-publish` (contracts/openapi-diff.md) |
| `internal/apperr/apperr.go` | `FuturePublish` |
| `internal/handler/handler.go` | Create / Update で書き込み後の行に `publishable` をかける |
| `internal/handler/feed.go` | `GetFeed` / `GetFeedImage`。純粋関数 `toRSS(rows) []byte` と `formatEntryDate(time.Time) string` |
| `internal/feed/` | `og-base.png` と `date-600.ttf` を `go:embed`。`Render(label string) ([]byte, error)` |
| `cmd/server/main_test.go` | `/feed` と `/feed/images/{entryDate}` の router テストを 1 件ずつ |

`internal/feed` を handler と分けるのは、埋め込み資産 (画像・フォント) を handler package に置かないため。

### frontend

| ファイル | 変更 |
|---|---|
| `src/shared/api/feed.server.ts` | `loadFeedXml()` (`cachedJson` に XML 文字列を 300 秒) と `isInFeed(xml, date)`。Vitest 1 件 (包含の判定) |
| `src/app/routes/feed[.]xml.ts` | server route。`loadFeedXml()` をそのまま返す |
| `src/app/routes/feed.images.$file.ts` | server route。`$file` を zod `^\d{4}-\d{2}-\d{2}\.png$` で検証し、`isInFeed` でなければ 404。あれば backend を中継し、200 だけ日付のキーで 300 秒キャッシュ |
| `src/app/routes/digest.$date.tsx` | 日ごとのページ (shell の外)。loader が `isInFeed` で 404 を決め、`head` で `og:*`・`noindex`・`canonical`・meta refresh (research R6) |
| `src/shared/api/cache.server.ts` | `cachedResponse(key, ttl, load)` を足す (画像はバイナリで、`cachedJson` に載らないため)。Vitest 1 件 |
| `src/shared/api/schemas.ts` | `problem` の type に `/problems/future-publish` |
| `src/pages/digest-editor/api/rejection-of.ts` (+ test) | `future-publish` を足す |
| `src/pages/digest-editor/ui/digest-editor-page.tsx` | 日付欄のエラーに出す |
| `src/app/routes/__root.tsx` | `<link rel="alternate" type="application/rss+xml" href="/feed.xml">` (リーダーがサイト URL からフィードを見つけるため) |
| `scripts/og-image.ts` | 日付を空けた下地を `backend/internal/feed/og-base.png` に書き出す処理を足す |

### 運用 (Cloudflare ダッシュボード)

- WAF の既存のレート制限ルールに `/feed` と `/digest/` を OR で足す。手順は quickstart.md

### 資産の生成 (justfile)

- `fe-og-image`: 既存の `og.png` に加えて下地も書き出す
- `be-og-font`: pinned の google/fonts から Klee One SemiBold を取り、日付の字だけの TTF サブセットを `backend/internal/feed/date-600.ttf` に書き出す

### デザインの扱い

下地のレイアウト (ロゴ・説明文の位置) と日付の大きさ・位置・色は仮の値で実装し、試作の画像を見てユーザーと決める (spec Assumptions)。決め直しは `og-image.ts` の HTML/CSS と `internal/feed` の定数だけで済む。

## Project Structure

### Documentation (this feature)

```text
specs/010-digest-rss-feed/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi-diff.md
│   └── rss.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code

```text
backend/
├── api/openapi.yaml
├── db/migrations/000011_digest_published_at.{up,down}.sql
├── db/queries/digests.sql
├── internal/apperr/apperr.go
├── internal/feed/{render.go,render_test.go,og-base.png,date-600.ttf}
├── internal/handler/{handler.go,feed.go,feed_test.go,handler_test.go}
└── cmd/server/main_test.go

frontend/
├── scripts/og-image.ts
└── src/
    ├── app/routes/{feed[.]xml.ts,feed.images.$file.ts,digest.$date.tsx,__root.tsx}
    ├── shared/api/{cache.server.ts,cache.server.test.ts,feed.server.ts,feed.server.test.ts,schemas.ts}
    └── pages/digest-editor/{api/rejection-of.ts,api/rejection-of.test.ts,ui/digest-editor-page.tsx}
```

**Structure Decision**: 既存の backend / frontend の 2 プロジェクト構成のまま。新しい package は `backend/internal/feed` の 1 つ。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 依存 `golang.org/x/image` の追加 | 標準ライブラリにはフォントで文字を描く機能がない | Workers で `@vercel/og` 相当 (satori + resvg)。Workers は無料プランで、CPU 10ms に描画が収まらない。日付ごとの画像を事前に作る (日付は登録のたびに増え、ビルドで作れない) |
