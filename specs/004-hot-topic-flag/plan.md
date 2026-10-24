# Implementation Plan: ホットトピックをカテゴリから記事のフラグへ移す

**Branch**: `004-hot-topic-flag` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-hot-topic-flag/spec.md`

## Summary

`Category` enum から「ホットトピック」を外して 6 つにし、記事に `hot` (boolean) を足す。DB は `articles.is_hot` 列を足し、子記事の行は `category` と同じく親の値を引き継いで持つ。既存の行は migration で `is_hot = true, category = 'その他'` に移す。API は `Article.hot` (必須) と `NewArticle.hot` (省略可、既定 false) を足す。frontend はトップの Digest で、`hot` の親の記事行のタイトルの後ろに炎のアイコンを付け、ホバー中は「HOT」の文字を左から右へ出す (タッチ端末では最初から出す)。記事は本来のカテゴリの区画に置いたままにし、専用の区画は作らない。登録画面には行ごとに「ホット」の checkbox を足す。新しい依存・API 操作・画面は増やさない。

## Technical Context

**Language/Version**: backend Go 1.26 / oapi-codegen strict server / sqlc + pgx v5 / PostgreSQL 18。frontend TypeScript strict / React 19 / TanStack Start

**Primary Dependencies**: 既存のみ

**Storage**: PostgreSQL。`articles` に `is_hot boolean NOT NULL DEFAULT false` を追加し、`category` の CHECK を 6 値に張り替える (migration 000006)

**Testing**: go test (`toDigest` の hot の受け渡し、seed パーサーの hot 記法)、Vitest (`groupByCategory` が hot を除く)、Playwright (`digest-new.spec.ts` の主経路に hot の行を 1 件足す)

**Target Platform**: backend Cloud Run、frontend Cloudflare Workers

**Project Type**: web (backend + frontend)

**Performance Goals**: 変化なし (列 1 つ、クエリ数は同じ)

**Constraints**: 本番に Digest が 1 件ある。migration で記事を失わない (SC-004)。印はトークンだけで書き、ホバーで行の折り返しを変えない

**Scale/Scope**: migration 1 本、OpenAPI のスキーマ 3 か所、sqlc クエリ 1 本、handler 2 関数、seed 1 つ、frontend の 5 ファイル + アイコン 1 つ削除、spec 2 本と UI ルール 1 本の追随

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md (004) を作成済み。本 plan の承認後に tasks へ進む。001 / 002 の固定カテゴリの記述は同じ変更で追随させる |
| II. 契約ファースト | PASS | `openapi.yaml` の `Category` / `Article` / `NewArticle` を先に変え、`just be-gen` で `gen.go` / `openapi.gen.ts` / sqlc を再生成する。生成物は同じコミットに含める |
| III. サーバー関数経由のみ | PASS | 経路は変えない。`newArticle` の zod に `hot` を足し、レスポンスの `article` の parse にも `hot` を足す |
| IV. 最小実装 | PASS | 汎用のタグ表や別テーブルは作らない (research R1)。`groupByCategory` は変えない。印は既存の `flame.tsx` を使い、新しいアイコンや依存を足さない |
| V. テストとスキーマ | PASS | 要件の落とし先: FR-001 → DB CHECK + OpenAPI enum + zod enum、FR-002 / FR-003 → DB の NOT NULL DEFAULT + `NewArticle.hot` の省略可、FR-009 → migration。テストの対応は [contracts/ui.md](./contracts/ui.md) の表 |

Post-design 再確認 (Phase 1 後): 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/004-hot-topic-flag/
├── plan.md              # 本ファイル
├── research.md          # Phase 0: 判断と却下した案
├── data-model.md        # Phase 1: articles の列、制約、migration の写し方
├── quickstart.md        # Phase 1: ローカルでの確認、本番の移行手順
├── contracts/
│   ├── openapi.md       # Phase 1: openapi.yaml の差分
│   └── ui.md            # Phase 1: 表示・登録画面の振る舞い、テスト対応表
└── tasks.md             # Phase 2 (/speckit-tasks で生成)
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                         # Category を 6 値に、Article.hot / NewArticle.hot
├── db/
│   ├── migrations/000006_hot_topic_flag.{up,down}.sql
│   ├── queries/digests.sql                  # CreateArticle に is_hot
│   └── seed.md                              # ホットトピック見出しを 🔥 記法に書き換え
├── internal/
│   ├── api/gen.go                           # 再生成
│   ├── db/{digests.sql.go,models.go}        # 再生成
│   └── handler/
│       ├── handler.go                       # CreateDigest で hot を親子に渡す、toDigest で Hot を出す
│       └── handler_test.go                  # TestToDigest に hot の親子を足す
└── cmd/seed/
    ├── main.go                              # `- 🔥 [title](url)` を hot として読む
    └── main_test.go

frontend/
├── src/shared/api/
│   ├── openapi.gen.ts                       # 再生成
│   └── schemas.ts                           # category を 6 値に、article.hot / newArticle.hot
├── src/pages/home/
│   ├── model/group-by-category.test.ts      # テストデータに hot
│   └── ui/
│       ├── digest.tsx / digest.module.css   # 炎と HOT の印
│       ├── about.tsx                        # カテゴリ一覧から外し、FAQ で説明
│       └── icons/flame.tsx                  # 印に使う (変更なし)
├── src/pages/digest-new/ui/digest-new-page.tsx  # 行ごとの「ホット」checkbox
└── e2e/digest-new.spec.ts                   # hot の行を 1 件足す

rules/frontend-ui-design.md                  # 「Digest の投稿」に印の型を追記 (.agents/rules は Nix 生成)
specs/001-digest-builder/spec.md             # FR-007 と Key Entities を 6 カテゴリに
specs/002-article-digest-view/spec.md        # FR-003 と Key Entities を 6 カテゴリ + ホットトピックの印に
```

**Structure Decision**: 既存の backend / frontend の配置に沿う。新しいディレクトリやスライスは作らない。

## Complexity Tracking

該当なし。
