# Implementation Plan: Digest の公開ステータス

**Branch**: `006-digest-status` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-digest-status/spec.md`

## Summary

`digests` に `status` (`draft` / `published` / `private`) の列を CHECK 付きで足し、既存の行は `published` で埋める。トップの `getLatestDigest` は `published` だけを見る。`listDigests` と `getDigestByDate` は `bearerAuth` を付けて管理者専用にする。作成は `NewDigest.status` (`draft` / `published`、既定 `draft`)、更新は新しい `DigestUpdate.status` (`published` / `private`、省略時は今のまま) で受ける。更新で `draft` を受け付けないので、下書きへ戻せないことは OpenAPI の validator だけで保証され、handler に移り方の分岐は要らない。frontend は登録・編集フォームの送信ボタンを、▼ で保存の方法を選んでから押す分割ボタンにし、日付一覧の下書き・非公開に文字の印を付ける。新しい依存・トークンはない。

## Technical Context

**Language/Version**: backend Go 1.26 / gin / oapi-codegen strict server / sqlc + pgx v5 / PostgreSQL 18。frontend TypeScript strict / React 19 / TanStack Start

**Primary Dependencies**: 既存のみ

**Storage**: PostgreSQL。migration `000010_digest_status` で列 1 つ + CHECK ([data-model.md](./data-model.md))

**Testing**: go test (router の表を 4 行直し、1 行足す)、Vitest (`digestUpdate` が `draft` を拒否する 1 件)、Playwright (`digest-edit` に下書き → 公開の流れ、`digest-new` に「公開」の選択 1 行)

**Target Platform**: backend Cloud Run、frontend Cloudflare Workers

**Project Type**: web (backend + frontend)

**Performance Goals**: 特になし

**Constraints**: ステータスの変更は記事と同じ 1 回の保存で反映する (FR-007 → 既存のトランザクション内の UPDATE 1 本)。トップは 5 分のキャッシュを通る (adr/frontend/0002) ので、公開・非公開の反映もそれを待つ

**Scale/Scope**: migration 1、OpenAPI のスキーマ 2 つ追加 + 3 つ変更、操作 2 つに認証、sqlc クエリ 4 本の変更。frontend はサーバー関数 4 つ、`schemas.ts`、送信ボタンを分割ボタンに、一覧に印 1 つ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md (006) を作成済み。本 plan の承認後に tasks へ進む |
| II. 契約ファースト | PASS | `openapi.yaml` に `DigestStatus` / `DigestUpdate` を足す ([contracts/openapi.md](./contracts/openapi.md))。`just be-gen` と `just db-doc` の差分を同じコミットに含める。エラーは既存の Problem の type だけを使う。※ constitution の「一覧は `{items: [...]}`」は b68061d で `digests` に変わっており、constitution 側の改正が別途要る (本機能の範囲外) |
| III. サーバー関数経由のみ | PASS | `listDigests` / `getDigest` に管理者のトークンを渡す。入力は zod、応答は `schemas.ts` の `parse` を通す |
| IV. 最小実装 | PASS | 移り方のルールを handler ではなくスキーマの enum で表す (R2)。既定値は DB に持たない (R1)。省略時は `COALESCE` 1 つで保つ (R3)。ステータス専用の API は作らない |
| V. テストとスキーマ | PASS | FR-001 → DB CHECK、FR-005 / FR-006 → OpenAPI の enum (2 種)、FR-003 → `bearerAuth`、FR-002 → `GetLatestDigest` の条件。テストの対応は [contracts/ui.md](./contracts/ui.md) の表。DB を通す確認は e2e と quickstart が担う |

Post-design 再確認 (Phase 1 後): 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/006-digest-status/
├── plan.md              # 本ファイル
├── research.md          # Phase 0: 判断と却下した案
├── data-model.md        # Phase 1: 列、移り方、クエリ、frontend の型
├── quickstart.md        # Phase 1: 自動チェックと手動確認
├── contracts/
│   ├── openapi.md       # Phase 1: openapi.yaml の差分、router テスト
│   └── ui.md            # Phase 1: 画面の振る舞い、テスト対応表
└── tasks.md             # Phase 2 (/speckit-tasks で生成)
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                          # DigestStatus / DigestUpdate、Digest / DigestSummary / NewDigest に status、2 操作に bearerAuth
├── api/http/digests.http                     # 一覧と 1 件取得に Bearer、更新で draft を送る例
├── db/migrations/000010_digest_status.{up,down}.sql
├── db/queries/digests.sql                    # GetLatestDigest / ListDigests / CreateDigest / UpdateDigest
├── internal/
│   ├── api/gen.go                            # 再生成
│   ├── db/{digests.sql.go,models.go}         # 再生成
│   └── handler/handler.go                    # status の受け渡し (作成の省略を draft に)、toDigest / ListDigests に status
└── cmd/server/main_test.go                   # router の表

docs/schema/                                  # just db-doc で再生成

frontend/
├── e2e/
│   ├── digest-new.spec.ts                    # 「公開」を選んで登録
│   └── digest-edit.spec.ts                   # 下書き → 一覧の印 → トップに出ない → 公開 → トップに出る
└── src/
    ├── pages/
    │   ├── digest-list/ui/digest-list-page.{tsx,module.css}   # 下書き・非公開の印
    │   └── digest-new/
    │       ├── api/{get-digest,create-digest,update-digest}.ts
    │       └── ui/digest-new-page.{tsx,module.css}            # 分割ボタン、saveActions
    └── shared/api/
        ├── list-digests.ts                   # トークンを渡す
        ├── schemas.ts                        # digestStatus / digestUpdate、各スキーマに status
        └── schemas.test.ts                   # digestUpdate が draft を拒否
```

**Structure Decision**: 既存の backend / frontend 2 プロジェクト構成のまま。新しいスライス・ルートはない。

## Complexity Tracking

違反なし。
