# Implementation Plan: Digest のタイムライン画面

**Branch**: `009-timeline-page` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-timeline-page/spec.md`

## Summary

`_shell` 配下に `/timeline` を足し、specs/008 の `listPublishedDigests` で取った公開の Digest を古い順に `DigestPost` で積む。未ログインは `beforeLoad` で `notFound` にし、サイドバーの `#timeline` はログイン中だけ出す。読み足しは投稿の列の上端に置いた状態表示の行を `IntersectionObserver` で見張り、見えたら最古の日付を `before` に渡して次の 7 件を取る (R2)。差し込みで位置が動かないよう、差し込む前の「下端からの距離」を保ち、`useLayoutEffect` で `scrollY` を合わせ直す (R3)。プレビューは管理者限定で任意の URL を取る `fetchDraftPreview` を `shared/api` に移して名前を変え、編集画面と共有する (R5)。backend・OpenAPI・migration・新しい依存はない。

## Technical Context

**Language/Version**: TypeScript strict / React 19 / TanStack Start + Router

**Primary Dependencies**: 既存のみ (react-aria、zod)。`IntersectionObserver` はブラウザ標準

**Storage**: なし (specs/008 の API を読むだけ)

**Testing**: Vitest 1 件 (ページを足したときの並びと続きの有無の判定)、Playwright は `digest-new.spec.ts` の末尾に「登録 → タイムラインの最下段に出る」を足す (R6)

**Target Platform**: Cloudflare Workers (SSR) + ブラウザ

**Project Type**: web (frontend のみ)

**Performance Goals**: 1 ページ 1 秒未満 (specs/008 SC-003 のまま)

**Constraints**: 差し込み時に位置を動かさない (Safari は `overflow-anchor` 未対応、R3)。router の `scrollRestoration: true` が初回の最下段へのスクロールを上書きしないこと (R4)

**Scale/Scope**: ルート 1、ページ 1 (ui 1 + model 1 + api 1)、サイドバー 1 行、プレビュー 2 ファイルの移動、Vitest 1、e2e 追記 1、UI ルール 1 行

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md (009) を作成済み。承認後に tasks → implement |
| II. 契約ファースト | PASS | backend の変更なし。specs/008 の `GET /digests/published` と `digestPage` をそのまま使う |
| III. サーバー関数経由のみ | PASS | 読み足しはクライアントから `listPublishedDigests` (zod 検証済み) を呼ぶ。プレビューも `requireAdminToken` を通すサーバー関数 |
| IV. 最小実装 | PASS | 投稿の見た目は既存の `DigestPost`。読み足しは標準の `IntersectionObserver` で、無限スクロールのライブラリを足さない。仮想化はしない (`ponytail:` で上限を残す、R2)。プレビューは新しく作らず移す (R5) |
| V. テストとスキーマ | PASS | 入力の形は既存の zod (`before` / `limit`)。続きの有無と並べ替えは Vitest、登録 → 表示のつながりは e2e。スクロール位置の保持と自動読み込みは quickstart の手動確認 (R6) |

Post-design 再確認 (Phase 1 後): 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/009-timeline-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui.md            # ルート・サーバー関数・画面の状態の契約
└── tasks.md             # /speckit-tasks で生成
```

### Source Code (repository root)

```text
frontend/src/
├── app/
│   ├── routes/_shell/timeline.tsx            # 新規: beforeLoad (notFound) + loader
│   └── layout/sidebar.tsx                    # ログイン中だけ #timeline
├── pages/
│   ├── digest-timeline/                      # 新規
│   │   ├── index.ts
│   │   ├── api/resolve-timeline-page.ts      # currentAdmin が無ければ notFound
│   │   ├── model/timeline.ts (+ .test.ts)    # ページを足す (古い順・続きの有無)
│   │   └── ui/timeline-page.tsx (+ .module.css)
│   └── digest-editor/
│       ├── api/fetch-draft-preview.ts        # 削除 (shared へ移動)
│       ├── api/load-draft-preview.ts         # 削除 (shared へ移動)
│       └── ui/{url-add-form,draft-card,preview-dialog}.tsx  # import 先を変更
└── shared/api/
    ├── fetch-any-link-preview.ts             # 移動 + 改名 (管理者限定)
    ├── load-any-link-preview.ts              # 移動 + 改名
    └── index.ts                              # export
frontend/e2e/digest-new.spec.ts               # 末尾にタイムラインの確認を追記
rules/frontend-ui-design.md                   # シェルの節にログイン中のタブ #timeline を追記
```

**Structure Decision**: 既存の FSD 構成のまま。読み足しの状態は画面 1 つでしか使わないので `pages/digest-timeline` に閉じ、`shared` には上げない。プレビューは 2 画面で使うので `shared/api` に上げる (pages どうしは import できない)。
