# Implementation Plan: 記事登録 (Digest 作成) 画面

**Branch**: `001-digest-builder` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-digest-builder/spec.md`

## Summary

`/admin/digests/new` の仮実装 (行ごとの入力フォーム) を、spec の「集める → 振り分ける → 登録」の画面に置き換える。左カラム (強調面) に日付・URL 入力・未分類の箱・登録ボタン、右カラムに固定 6 カテゴリの箱を置き、候補を dnd-kit のドラッグで箱の間・箱の中で動かす。タイトルはトップの記事プレビューで使っている取得処理を `shared` に移し、管理者用のサーバー関数から呼ぶ。登録は既存の `createDigest` (POST /digests) をそのまま使う。backend・OpenAPI・DB は変更しない。

## Technical Context

**Language/Version**: TypeScript (strict) / React 19

**Primary Dependencies**: TanStack Start + Router、Zod、`@dnd-kit/react` + `@dnd-kit/helpers` 0.5.1 (新規、research R1)

**Storage**: なし (候補はページ内の state。登録先は既存の backend `POST /digests`)

**Testing**: Vitest (候補の操作と送信データへの変換の純粋関数)、Playwright (`e2e/digest-new.spec.ts` を書き直し、1 本)

**Target Platform**: Cloudflare Workers (SSR) + PC のモダンブラウザ。狭い画面は縦積みで操作できれば足りる

**Project Type**: Web アプリ (frontend のみ変更)

**Performance Goals**: 候補 100 件 + 関連記事でドラッグが引っかからないこと (箱単位の memo、research R2)

**Constraints**: backend はサーバー関数経由のみ (constitution III)。色・余白はトークンのみ。新しい依存は dnd-kit だけ

**Scale/Scope**: 1 画面。記事 100 件 × 関連記事 20 件まで

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec を 2026-10-25 に改訂し、本 plan → tasks → implement の順で進める |
| II. 契約ファースト | ✅ | backend API の変更なし。登録は既存の `NewDigest` 契約に合わせる |
| III. サーバー関数境界 | ✅ | タイトル取得・登録ともサーバー関数。入力は Zod (`.validator`) で検証 |
| IV. 最小実装 | ✅ (要記録 1 件) | 新規依存 dnd-kit は Complexity Tracking に記録。times-news の `renderLayoutTree` / `react-resizable-panels` / 汎用 `SortableArea` は持ち込まない。`Favicon` とプレビュー取得は 2 ページ目で使うので `shared` へ上げる |
| V. テストとスキーマ | ✅ | 送信データは既存の `newDigest` (Zod) を通る。分岐のある純粋関数に Vitest、画面の主経路に e2e 1 本 |

Phase 1 後の再確認: 変化なし (設計で新しい層・設定・依存を足していない)。

## Project Structure

### Documentation (this feature)

```text
specs/001-digest-builder/
├── plan.md              # 本ファイル
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── server-functions.md
├── item-data-model.md   # 旧設計メモ (翻訳など後続フェーズ用。本 plan では参照のみ)
└── tasks.md             # /speckit-tasks で作る
```

### Source Code

```text
frontend/
├── package.json                                   # + @dnd-kit/react, @dnd-kit/helpers, @dnd-kit/dom
├── e2e/digest-new.spec.ts                         # 書き直し (主経路 1 本 + 未ログイン 404)
└── src/
    ├── shared/
    │   ├── api/link-preview.server.ts             # ← pages/home/api/get-link-preview.ts の取得・復号・キャッシュ部分を移す
    │   ├── lib/parse-link-preview.ts (+ .test.ts) # ← pages/home/model/parse-link-preview.ts を移す
    │   └── ui/favicon.tsx (+ .module.css, fallback-favicon.svg)  # ← pages/home/ui/preview-card.tsx の Favicon を移す
    │       ui/chevron.tsx, ui/icons/flame.tsx                    # ← pages/home/ui から移す (箱の開閉とホットの印で使う)
    ├── pages/home/                                # 移した先を import するだけ (挙動は変えない)
    └── pages/digest-new/
        ├── index.ts
        ├── api/
        │   ├── create-digest.ts                   # 既存のまま
        │   ├── resolve-digest-new-page.ts         # 既存のまま
        │   └── fetch-draft-title.ts               # 新規: 管理者だけが任意 URL のタイトルを取る
        ├── model/
        │   ├── board.ts (+ board.test.ts)         # 候補の操作と送信データへの変換 (data-model.md)
        └── ui/
            ├── digest-new-page.tsx (+ .module.css)  # 2 カラム、URL 入力、登録、離脱確認
            ├── box.tsx (+ .module.css)              # 箱: 見出し (名前・件数・開閉) + droppable
            └── draft-card.tsx (+ .module.css)       # 候補カード: sortable、ハンドル、··· メニュー、編集
```

**Structure Decision**: FSD に従い、この画面だけで使うもの (箱・カード・ドラッグの配線) は `pages/digest-new` に置く。トップと共有するもの (favicon、ページ情報の取得と解析) は `pages` 間で import できないので `shared` に上げる。times-news の `SortableArea` のような汎用部品にはせず、`move()` の呼び出しはページの中に書く (使う画面が 1 つのため)。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 新規依存 `@dnd-kit/react` + `@dnd-kit/helpers` + `@dnd-kit/dom` (読み上げの日本語化のため、research R1) | 箱をまたぐ並べ替えを、ポインター・タッチ・キーボードで同じように行う (FR-012〜014) | HTML5 ネイティブの DnD はタッチで動かず、キーボード操作とドロップ位置の表示を自前で書くことになる。導入済みの `motion` の `Reorder` は 1 つのリストの中しか並べ替えられない |
