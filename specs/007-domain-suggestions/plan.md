# Implementation Plan: ドメイン候補

**Branch**: `007-domain-suggestions` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-domain-suggestions/spec.md`

## Summary

公開の Digest の記事だけを数える `GET /articles/domains?q=&limit=` (ログインユーザー向け) と、ステータスを問わない `GET /articles/domains/all?q=&limit=` (管理者向け) を足す。今ログインできるのは管理者だけなので、どちらも `bearerAuth` だけで足りる (R10)。ドメインは保存せず、`articles.url` から正規表現でホストを取り出し、`GROUP BY` で件数を数える sqlc クエリ 1 本で返す。公開分かどうかはクエリの引数で切り替える (R9)。絞り込みは `strpos(lower(host), lower(q))` にし、`LIKE` を使わないので `%` / `_` のエスケープが要らない。`limit` (1〜50、既定 20) と `q` (100 文字まで) の形は OpenAPI の validator で 400 にする。frontend は `schemas.ts` のスキーマと、zod で入力を検証するサーバー関数 `listArticleDomains` / `listAllArticleDomains` を足す。migration・新しい依存・UI 部品はない。

## Technical Context

**Language/Version**: backend Go 1.26 / gin / oapi-codegen strict server / sqlc + pgx v5 / PostgreSQL 18。frontend TypeScript strict / React 19 / TanStack Start

**Primary Dependencies**: 既存のみ

**Storage**: PostgreSQL。スキーマの変更なし。`articles.url` と `digests.status` を読むだけ ([data-model.md](./data-model.md))

**Testing**: go test (router の表に 3 行: 2 つの経路とも未ログインは 401、`limit` が範囲外は 400)。Vitest・Playwright は足さない ([research.md](./research.md) R5)

**Target Platform**: backend Cloud Run、frontend Cloudflare Workers

**Project Type**: web (backend + frontend)

**Performance Goals**: 記事数百件で 1 秒未満 (SC-003)。全件を走査しても数 ms で終わる規模

**Constraints**: 記事の変更がすぐ反映される (FR-009) → 保存せず毎回数える。サーバー関数はキャッシュを通さない

**Scale/Scope**: OpenAPI に操作 2 つ・パラメーター 2 つ・スキーマ 2 つ、sqlc クエリ 1 本、handler 2 つ (中身は共通)、router テスト 3 行。frontend はサーバー関数 2 つ、`schemas.ts` に 2 つ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md (007) を作成済み。US4 (公開分) を追加し、本 plan と tasks を合わせて更新した |
| II. 契約ファースト | PASS | `openapi.yaml` に `listArticleDomains` / `listAllArticleDomains` を足し ([contracts/openapi.md](./contracts/openapi.md))、SQL は `db/queries/articles.sql` から sqlc で生成する。`just be-gen` の差分を同じコミットに含める。エラーは既存の Problem だけ。※ 一覧の包みは既存の `DigestList` (`digests`) に揃えて `domains` にする。constitution の `{items: [...]}` は 006 の plan で指摘済みの未改正 |
| III. サーバー関数経由のみ | PASS | 2 つのサーバー関数が `requireAdminToken()` のトークンで呼ぶ (一般ユーザーのセッションができたら公開分はそのトークンに替える)。入力は zod、応答は `schemas.ts` の `parse` |
| IV. 最小実装 | PASS | `domains` テーブル・生成列・index・`pg_trgm` を作らない (R1, R2)。handler は sqlc の結果を詰め替えるだけ。SQL は 1 本 (R9)、役割の判定は作らない (R10) |
| V. テストとスキーマ | PASS | FR-004 / FR-005 → OpenAPI の `minimum` / `maximum` / `maxLength`、FR-007 / FR-011 → `bearerAuth`、FR-001〜003 / 006 / 008 / 010 → SQL。router テストで 401 と 400 を押さえる。SQL の振る舞いは quickstart の手動確認が担う (R5) |

Post-design 再確認 (Phase 1 後): 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/007-domain-suggestions/
├── plan.md              # 本ファイル
├── research.md          # Phase 0: 判断と却下した案
├── data-model.md        # Phase 1: 求め方、クエリ、frontend の型
├── quickstart.md        # Phase 1: 自動チェックと手動確認
├── contracts/
│   └── openapi.md       # Phase 1: openapi.yaml の差分、router テスト
└── tasks.md             # Phase 2 (/speckit-tasks で生成)
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                 # /articles/domains、/articles/domains/all、DomainQuery / DomainLimit、DomainList / DomainCount
├── db/queries/articles.sql          # 新規: ListArticleDomains
├── internal/
│   ├── api/gen.go                   # 生成
│   ├── db/articles.sql.go           # 生成
│   └── handler/handler.go           # ListArticleDomains / ListAllArticleDomains
└── cmd/server/main_test.go          # router の表に 3 行

frontend/src/shared/api/
├── schemas.ts                       # domainCount, domainList
├── list-article-domains.ts          # 新規: サーバー関数 2 つ
├── index.ts                         # export
└── openapi.gen.ts                   # 生成
```

**Structure Decision**: 既存の web 構成のまま。frontend は `listDigests` と同じく `shared/api` に置く。使う画面がまだないので `pages/` には何も足さない。
