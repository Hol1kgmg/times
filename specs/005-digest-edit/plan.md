# Implementation Plan: 登録済みの Digest を編集する

**Branch**: `005-digest-edit` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-digest-edit/spec.md`

## Summary

API を 3 つ足す: `GET /digests` (日付一覧、公開)、`GET /digests/{entryDate}` (1 件、公開)、`PUT /digests/{entryDate}` (全置換、管理者)。更新は 1 トランザクションで「日付の更新 → 記事の全削除 → 登録済み URL の判定 → 挿入」の順に行う。この順にすると、日付の衝突は既存の UNIQUE とエラー写像で、自分の URL の除外は削除済みであることで、どちらもクエリを増やさずに満たせる。挿入は `CreateDigest` から関数に切り出して共用する。frontend は日付一覧 `/admin/digests` (新スライス `pages/digest-list`) と編集画面 `/admin/digests/$date/edit` を足す。編集画面は `DigestNewPage` を props 化して流用し、初期値は `fromDigest` で作る。`initial` に保存済みの値を入れるので、既存の `revert` がそのまま「変更を戻す」の仕様を満たし、変えるのはラベルだけになる。migration・新しい依存・新しいトークンはない。

## Technical Context

**Language/Version**: backend Go 1.26 / gin v1.12 / oapi-codegen strict server / sqlc + pgx v5 / PostgreSQL 18。frontend TypeScript strict / React 19 / TanStack Start

**Primary Dependencies**: 既存のみ

**Storage**: PostgreSQL。テーブルと制約は変えない。クエリを 4 本足す ([data-model.md](./data-model.md))

**Testing**: go test (router の表に 3 行)、Vitest (`fromDigest` の往復と戻り先の 2 件)、Playwright (`digest-edit.spec.ts` 1 本 + 既存の未ログインテストに 1 行)

**Target Platform**: backend Cloud Run、frontend Cloudflare Workers

**Project Type**: web (backend + frontend)

**Performance Goals**: 特になし。一覧は 1 日 1 行で、年 365 行程度

**Constraints**: 保存は一部だけ置き換わった状態を残さない (FR-007 → 1 トランザクション)。gin の経路は同じ位置で別名のパラメーターを持てない (research R4)

**Scale/Scope**: OpenAPI の操作 3 つ + スキーマ 2 つ、sqlc クエリ 4 本、handler 3 関数 + 挿入処理の切り出し。frontend はルート 2、ページスライス 1 (`digest-list`)、サーバー関数 3、`board.ts` に関数 1 つ、`DigestNewPage` の props 化、サイドバーに 1 行、ラベル 2 か所

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md (005) を作成済み。本 plan の承認後に tasks へ進む |
| II. 契約ファースト | PASS | `openapi.yaml` に 3 操作を足し ([contracts/openapi.md](./contracts/openapi.md))、`just be-gen` で `gen.go` / `openapi.gen.ts` / sqlc を再生成して同じコミットに含める。一覧は `{items: [...]}` で包む。エラーは既存の Problem の type だけを使う |
| III. サーバー関数経由のみ | PASS | `listDigests` / `getDigest` / `updateDigest` をサーバー関数にし、入力は zod (`validator`)、応答は `schemas.ts` の `parse` を通す |
| IV. 最小実装 | PASS | 全置換にして差分計算を作らない (R1)。自分の URL の除外はクエリを変えずに処理順で満たす (R2)。日付の衝突は既存の制約と写像を使う (R3)。編集画面は新規登録の UI を props 化して使い、`shared` への移動はしない (R7)。管理者 1 人の前提で一覧を絞らない点と、スライス名を `digest-new` のまま使う点は `ponytail:` として research に記録 |
| V. テストとスキーマ | PASS | FR-009 / FR-010 → DB UNIQUE + `constraintViolation`、FR-008 → DB UNIQUE + `ListRegisteredURLs`、FR-011 → `UpdateDigestDate` の `created_by` 条件、形式 → OpenAPI。テストの対応は [contracts/ui.md](./contracts/ui.md) の表。DB を通すテストは書かず、e2e と quickstart が担う |

Post-design 再確認 (Phase 1 後): 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/005-digest-edit/
├── plan.md              # 本ファイル
├── research.md          # Phase 0: 判断と却下した案
├── data-model.md        # Phase 1: 使う制約、追加クエリ、保存の手順、frontend の型
├── quickstart.md        # Phase 1: 自動チェックと手動確認
├── contracts/
│   ├── openapi.md       # Phase 1: openapi.yaml の差分、router テスト
│   └── ui.md            # Phase 1: 画面の振る舞い、テスト対応表
└── tasks.md             # Phase 2 (/speckit-tasks で生成)
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                         # listDigests / getDigestByDate / updateDigest、DigestList / DigestSummary
├── api/http/digests.http                    # 手で叩く例を 3 つ足す
├── db/queries/digests.sql                   # ListDigests / GetDigestByDate / UpdateDigestDate / DeleteArticlesByDigest
├── internal/
│   ├── api/gen.go                           # 再生成
│   ├── db/digests.sql.go                    # 再生成
│   └── handler/handler.go                   # ListDigests / GetDigestByDate / UpdateDigest、挿入処理を CreateDigest から切り出す
└── cmd/server/main_test.go                  # router の表に 3 行、stub に ListDigests

frontend/
├── e2e/
│   ├── digest-edit.spec.ts                  # 新規 1 本
│   └── digest-new.spec.ts                   # 未ログインのテストに /admin/digests の 404 を 1 行
└── src/
    ├── app/
    │   ├── layout/sidebar.tsx               # 「記事を編集」
    │   └── routes/_shell/
    │       ├── admin.digests.index.tsx      # 日付一覧 (index にして new / edit の親にしない。research R8)
    │       └── admin.digests.$date.edit.tsx # 編集画面
    ├── pages/
    │   ├── digest-list/                     # 新規: index.ts、api/list-digests.ts、ui/digest-list-page.{tsx,module.css}
    │   └── digest-new/
    │       ├── index.ts                     # DigestEditPage / getDigest / updateDigest を足す
    │       ├── api/get-digest.ts            # 新規
    │       ├── api/update-digest.ts         # 新規 (create-digest.ts と同じ作り、成功時は /admin/digests へ)
    │       ├── model/board.ts               # fromDigest
    │       ├── model/board.test.ts          # 2 件
    │       ├── ui/digest-new-page.tsx       # props 化、DigestEditPage
    │       └── ui/draft-card.tsx            # 「変更を戻す」
    └── shared/
        ├── api/schemas.ts                   # digestSummary / digestList
        └── ui/digest-post.tsx               # dateFormat を export
```

**Structure Decision**: 既存の backend / frontend 2 プロジェクト構成のまま。編集画面は新規登録と UI が同じなので `pages/digest-new` に同居させ、日付一覧だけ新しいスライスにする (research R7)。

## Complexity Tracking

違反なし。
