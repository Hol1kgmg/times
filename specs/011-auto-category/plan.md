# Implementation Plan: 記事のカテゴリを AI で推定して振り分ける

**Branch**: `011-auto-category` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-auto-category/spec.md`

## Summary

登録・編集画面で URL を追加し、タイトルの取得が終わったら、管理者専用のサーバー関数 `suggestCategory` を呼ぶ。サーバー関数は Workers AI の `@cf/cloudflare/clef` に `choice` 型の質問を 1 つ投げ、いちばん高い確率が 0.5 以上ならそのカテゴリを返す。推定の手段がない (`cloudflare:workers` が無いローカル開発) ときは `null` を返す。クライアントは、候補がまだ未分類にあるときだけ推定の箱の末尾へ移し、`suggested: true` の印を付ける。手で別の箱へ移したら印を外す。印は board の state だけに持ち、保存の形 (`toNewDigest`) は変えない。backend・DB・OpenAPI は触らない。

## Technical Context

**Language/Version**: TypeScript (strict) / React 19

**Primary Dependencies**: TanStack Start (サーバー関数)、Zod、Workers AI binding (新しい npm 依存はなし)

**Storage**: なし (推定の印はクライアントの state のみ、FR-006)

**Testing**: Vitest (board の純粋関数、clef の答えからカテゴリへの変換)

**Target Platform**: Cloudflare Workers (本番)、`vite dev` の Node (ローカル。推定は無効)

**Project Type**: web (frontend のみの変更)

**Performance Goals**: 推定はタイトルの取得の後に非同期で行い、追加の入力欄を止めない

**Constraints**: AI binding は Workers の実行時にしかない。`@cloudflare/vite-plugin` は入れない (方針 A)

**Scale/Scope**: 1 Digest あたり最大 100 件の追加 → 最大 100 回の推定。clef は入力 $0.24/M token、出力は無料。1 回 数百 token なので、費用は無視できる

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec.md → 本 plan → tasks の順。承認後に実装する |
| II. 契約ファースト | ✅ (対象外) | backend の API と SQL は変えない |
| III. backend はサーバー関数経由 | ✅ | Workers AI は frontend サーバー (Worker) から呼ぶ。ブラウザは `suggestCategory` だけを呼び、入力は Zod で検証する |
| IV. 最小実装 | ✅ | 新しい依存なし。Workers の型は必要な分だけ手で宣言する (`@cloudflare/workers-types` は入れない)。サービス層は置かない |
| V. テストとスキーマ | ✅ | 入力は `.validator(z.object(...))`、clef の答えは Zod で `parse`。分岐 (しきい値、未分類のときだけ移す、印を外す) は Vitest で押さえる |

設計後の再確認: 違反なし。Complexity Tracking は空。

## Project Structure

### Documentation (this feature)

```text
specs/011-auto-category/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── suggest-category.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code

```text
frontend/
├── vite.config.ts                                    # ssr 環境で cloudflare:* を external にする
├── wrangler.toml                                     # [ai] binding = "AI"
└── src/
    ├── shared/api/
    │   ├── cloudflare-workers.d.ts                   # cloudflare:workers の env の最小の型
    │   ├── category-suggestion.server.ts             # AI binding の取得、clef の答え → Category | null
    │   ├── category-suggestion.server.test.ts
    │   ├── suggest-category.ts                       # サーバー関数 (requireAdminToken + validator)
    │   └── index.ts                                  # suggestCategory を export
    └── pages/digest-editor/
        ├── model/board.ts                            # Draft.suggested、settleCategory、移動で印を外す
        ├── model/board.test.ts
        └── ui/
            ├── url-add-form.tsx                      # タイトルの取得後に推定を呼ぶ
            ├── draft-card.tsx                        # 推定の印
            └── draft-card.module.css
```

**Structure Decision**: 既存の `fetchAnyLinkPreview` (`shared/api/fetch-any-link-preview.ts` + `link-preview.server.ts`) と同じ分け方にする。サーバー関数の宣言はクライアントから import できる名前のファイルに置き、Workers 固有の処理は `*.server.ts` に閉じる。

## Complexity Tracking

なし。
