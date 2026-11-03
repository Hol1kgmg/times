# Implementation Plan: Digest のタイムライン

**Branch**: `008-digest-timeline` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-digest-timeline/spec.md`

## Summary

管理者が作成した公開の Digest を、記事ごと日付の新しい順に返す `GET /digests/published?before=&limit=` (`bearerAuth`) を足す。Digest の一覧は sqlc クエリ 1 本で取り、`users` のサブクエリで作成者を `lower(login) = lower(adminLogin)` に絞る (R2)。作成者が 1 人に絞られ、`UNIQUE (created_by, entry_date)` で日付が一意なので、続きは `entry_date < before` のキーセットで決まる (R3)。各 Digest の記事は既存の `withArticles` → `toDigest` で読み、トップと同じ形と並びを新しいコードなしで保つ (R4)。`limit` (1〜31、既定 7) と `before` (日付) の形は OpenAPI の validator で 400 にする。frontend は `schemas.ts` の `digestPage` と、zod で入力を検証するサーバー関数 `listPublishedDigests` を足す。migration・新しい依存・画面はない。

## Technical Context

**Language/Version**: backend Go 1.26 / gin / oapi-codegen strict server / sqlc + pgx v5 / PostgreSQL 18。frontend TypeScript strict / React 19 / TanStack Start

**Primary Dependencies**: 既存のみ

**Storage**: PostgreSQL。スキーマの変更なし。`digests` と `users` を読み、記事は既存のクエリで読む ([data-model.md](./data-model.md))

**Testing**: go test (router の表に 1 行: 未ログインは 401)。Vitest・Playwright は足さない ([research.md](./research.md) R6)

**Target Platform**: backend Cloud Run、frontend Cloudflare Workers

**Project Type**: web (backend + frontend)

**Performance Goals**: 1 ページ 1 秒未満 (SC-003)。既定 7 件で 15 クエリ、上限 31 件で 63 クエリ (R4)

**Constraints**: 公開・非公開の切り替えが次の要求から反映される → サーバー関数はキャッシュを通さない (R7)

**Scale/Scope**: OpenAPI に操作 1 つ・スキーマ 1 つ、sqlc クエリ 1 本、handler 1 つ、router テスト 1 行。frontend はサーバー関数 1 つ、`schemas.ts` に 1 つ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md (008) を作成済み。管理者への絞り込み (US4・FR-010) と DB が保証しないことを反映した |
| II. 契約ファースト | PASS | `openapi.yaml` に `listPublishedDigests` と `DigestPage` を足し ([contracts/openapi.md](./contracts/openapi.md))、SQL は `db/queries/digests.sql` から sqlc で生成する。`just be-gen` の差分を同じコミットに含める。エラーは既存の Problem だけ。※ 一覧の包みは既存の `DigestList` に揃えて `digests`。constitution の `{items: [...]}` は 006 の plan で指摘済みの未改正 |
| III. サーバー関数経由のみ | PASS | サーバー関数が `requireAdminToken()` のトークンで呼ぶ (一般ユーザーのセッションができたら差し替える)。入力は zod、応答は `schemas.ts` の `parse` |
| IV. 最小実装 | PASS | 記事の取得と変換は既存の `withArticles` を使い、まとめて取る 2 クエリと振り分けの関数を作らない (R4、`ponytail:` で上限を残す)。`nextBefore`・役割の列・`users.login` の UNIQUE を作らない (R2, R3) |
| V. テストとスキーマ | PASS | FR-003 / FR-005 の形 → OpenAPI の `minimum` / `maximum` / `format: date`、FR-009 → `bearerAuth`、FR-002 / FR-005 / FR-006 / FR-008 / FR-010 → SQL、FR-004 / FR-007 → 既存の `withArticles`。router テストで 401 を押さえる。SQL の振る舞いは quickstart の手動確認が担う (R6) |

Post-design 再確認 (Phase 1 後): 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/008-digest-timeline/
├── plan.md              # 本ファイル
├── research.md          # Phase 0: 判断と却下した案
├── data-model.md        # Phase 1: 頼る制約、クエリ、frontend の型
├── quickstart.md        # Phase 1: 自動チェックと手動確認
├── contracts/
│   └── openapi.md       # Phase 1: openapi.yaml の差分、router テスト
└── tasks.md             # Phase 2 (/speckit-tasks で生成)
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                 # /digests/published、DigestPage
├── db/queries/digests.sql           # 新規: ListPublishedDigests
├── internal/
│   ├── api/gen.go                   # 生成
│   ├── db/digests.sql.go            # 生成
│   └── handler/handler.go           # ListPublishedDigests (s.adminLogin を渡し、withArticles を Digest ごとに呼ぶ)
└── cmd/server/main_test.go          # TestRouter に 1 行

frontend/src/shared/api/
├── schemas.ts                       # digestPage
├── list-published-digests.ts        # 新規: サーバー関数
├── index.ts                         # export
└── openapi.gen.ts                   # 生成
```

**Structure Decision**: 既存の web 構成のまま。frontend は `listDigests` と同じく `shared/api` に置く。使う画面がまだないので `pages/` と `routes/` には何も足さない。
