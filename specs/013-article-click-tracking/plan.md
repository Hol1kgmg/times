# Implementation Plan: 記事リンクのクリック数を記事ごとに数える

**Branch**: `013-article-click-tracking` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-article-click-tracking/spec.md`

## Summary

`DigestPost` に省略可能な `onOpen` を足し、トップとタイムラインだけが渡す。記事リンクの `onPress` と中クリックの `onAuxClick` で、ブラウザは自サイトの `POST /open` (Workers のサーバールート) に `{ articleId, url, entryDate }` を `fetch` + `keepalive` で送る。受付は Zod で検証し、UA で bot を除き、`waitUntil` で GA4 Measurement Protocol に `article_click` を転送して 204 を返す。地域は `ip_override`、端末は `device.category` で載せる (research R1)。backend・DB・OpenAPI は変えない。

## Technical Context

**Language/Version**: TypeScript (strict)、React 19

**Primary Dependencies**: TanStack Start (サーバールート)、Zod、React Aria Components、Cloudflare Workers (`cloudflare:workers` の `waitUntil`)、GA4 Measurement Protocol (`fetch`)。新しい依存は足さない

**Storage**: N/A (GA4 に溜める。DB は変えない)

**Testing**: Vitest (本文の検証、bot の除外、URL の切り詰め、端末の分類)、Playwright (`digest-new` に 1 手順: トップで記事を押すと `/open` が飛ぶ)

**Target Platform**: Cloudflare Workers (`nodejs_compat`、シークレットは `process.env`)、PC・モバイルのブラウザ

**Project Type**: web (frontend だけを変える)

**Performance Goals**: 記事が開くまでの時間を変えない (spec SC-006)。送信は応答を待たず、受付も GA4 への送信を `waitUntil` で応答の後に回す

**Constraints**: href は記事の URL のまま。GA の認証情報はサーバーだけ。受付のパスに計測らしい語を使わない。GA4 のパラメータ値は 100 文字まで

**Scale/Scope**: 1 日約 20 記事、閲覧は個人サイト規模 (Measurement Protocol の上限 1 億件/時に遠く及ばない)

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec → plan → tasks の順。実装は承認後 |
| II. 契約ファースト | ✅ | backend を変えない。受付の契約は `contracts/article-open.md` |
| III. サーバー関数経由 | ✅ | ブラウザは backend を呼ばない。受付は Workers の中で閉じ、GA4 だけを呼ぶ。入力は Zod で検証する |
| IV. 最小実装 | ✅ | 依存を足さない (UA 解析・bot 判定は正規表現 1 本ずつ、`ponytail:` で上限を残す)。受付は 1 ファイル、送信は `onOpen` 1 本 |
| V. テストとスキーマ | ✅ | 本文は `articleId` / `z.url()` / `z.iso.date()` の Zod。分岐 (bot・端末・切り詰め・不正な本文) は Vitest。UI と受付のつながりは e2e 1 手順。プレビューから送れないことは型で押さえる |

Phase 1 の設計の後も違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/013-article-click-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/article-open.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/routes/open.ts                       # 新規: POST /open のサーバールート
│   ├── shared/api/
│   │   ├── article-open.server.ts               # 新規: 本文の検証、bot 除外、GA4 のイベント組み立てと送信
│   │   ├── article-open.server.test.ts          # 新規: Vitest
│   │   ├── report-article-open.ts               # 新規: ブラウザからの fetch + keepalive
│   │   └── cloudflare-workers.d.ts              # waitUntil の宣言を足す
│   ├── shared/ui/digest-post.tsx                # onOpen (合併の props)、onPress / onAuxClick
│   ├── pages/home/ui/digest-card.tsx            # onOpen を渡す
│   └── pages/digest-timeline/ui/timeline-page.tsx  # onOpen を渡す
└── e2e/digest-new.spec.ts                       # トップで記事を押すと /open が飛ぶ 1 手順
docs/tech-stack.md                               # GA_MEASUREMENT_ID / GA_API_SECRET を環境変数の一覧に足す
```

**Structure Decision**: frontend の中だけで閉じる。受付は `feed[.]xml.ts` と同じサーバールートの形で、処理は `shared/api/*.server.ts` に置いて Vitest で試す。`DigestPost` は通信を持たず、送信の関数を `onOpen` で受ける。

## Complexity Tracking

違反なし。
