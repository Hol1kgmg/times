# Implementation Plan: 匿名 ID で記事別 UU・サイト UU・DAU・MAU を数える

**Branch**: `014-anonymous-analytics` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-anonymous-analytics/spec.md`

## Summary

ブラウザで匿名 ID (localStorage の UUID、保存できなければページ内の変数) を持ち、specs/013 の `POST /open` に `clientId` として足す。受付の本文を `event` で分ける合併にして `page_view` も受け、GA4 には `client_id` = 匿名 ID で転送する。`page_view` は `__root` の部品が公開画面の routeId のときだけ、pathname が変わるたびに 1 件送る (research R2)。トップの FAQ に「何か記録してる？」を足し、集計の出し方と制約を `docs/analytics.md` にまとめる。backend・DB・OpenAPI は変えない。

## Technical Context

**Language/Version**: TypeScript (strict)、React 19

**Primary Dependencies**: TanStack Start / Router (`useRouterState`、サーバールート)、Zod、Cloudflare Workers (`waitUntil`)、GA4 Measurement Protocol。新しい依存は足さない

**Storage**: ブラウザの localStorage (匿名 ID だけ)。DB は変えない

**Testing**: Vitest (匿名 ID の再利用・作り直し・保存できないとき、受付の合併・UUID・4 KB・クエリ落とし・切り詰め)、Playwright (`digest-new` の既存の手順を広げる: トップを開くと `page_view`、記事を押すと `article_click` が同じ `clientId` で飛ぶ)

**Target Platform**: Cloudflare Workers、PC・モバイルのブラウザ

**Project Type**: web (frontend だけを変える)

**Performance Goals**: 画面の表示と記事が開くまでの時間を変えない。送信は応答を待たない

**Constraints**: GA の認証情報はサーバーだけ。ログイン画面の秘密のパスや管理画面の URL を GA4 に載せない。GA4 の上限 (`page_location` 1,000 / `page_title` 300 / ほか 100 文字)

**Scale/Scope**: 個人サイト規模。Measurement Protocol の上限に遠く及ばない

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec → plan → tasks の順。実装は承認後 |
| II. 契約ファースト | ✅ | backend を変えない。受付の契約は `contracts/open.md` (specs/013 を置き換え) |
| III. サーバー関数経由 | ✅ | ブラウザは backend を呼ばない。受付は Workers の中で閉じる。入力は Zod |
| IV. 最小実装 | ✅ | 依存を足さない。受付は 1 本のまま合併で広げる。`page_view` の部品は `__root.tsx` に置き、別ファイルにしない。BigQuery Export・自前の保存は手順書に条件を書くだけ |
| V. テストとスキーマ | ✅ | 本文は Zod の `discriminatedUnion`。匿名 ID の分岐 (保存済み・壊れた値・例外) と受付の分岐は Vitest。ブラウザ → 受付のつながりは e2e の既存の 1 本を広げる (新しい spec は作らない) |

Phase 1 の設計の後も違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/014-anonymous-analytics/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/open.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/routes/
│   │   ├── __root.tsx                           # page_view を送る部品 (許可リストの routeId、直前の pathname)
│   │   └── open.ts                              # handleOpen に差し替え
│   ├── shared/lib/
│   │   ├── anonymous-id.ts                      # 新規: localStorage の UUID、壊れていれば作り直し、例外ならメモリ
│   │   └── anonymous-id.test.ts                 # 新規: Vitest
│   ├── shared/api/
│   │   ├── article-open.server.ts → open.server.ts            # 合併の本文、4 KB、clientId、page_view の組み立て
│   │   ├── article-open.server.test.ts → open.server.test.ts  # 既存 4 件 + 合併・UUID・4 KB・クエリ落とし
│   │   ├── report-article-open.ts → report.ts                 # reportArticleOpen + reportPageView、どちらも clientId を付ける
│   │   └── index.ts                             # export の差し替え
│   └── pages/home/ui/about.tsx                  # FAQ に「何か記録してる？」
└── e2e/digest-new.spec.ts                       # page_view と article_click の clientId が揃うこと
docs/analytics.md                                # 新規: 指標の定義、GA4 での出し方、制約、代わりの方法、実測の結果
rules/frontend-ui-design.md                      # FAQ の範囲に「計測」を足す (rules.nix で .agents/rules に同期)
```

**Structure Decision**: 受付は specs/013 のサーバールートを 1 本のまま広げ、イベントの名前に寄らないファイル名 (`open.server.ts` / `report.ts`) に改める。匿名 ID はブラウザだけで使う純粋な部品なので `shared/lib` に置く。`page_view` の部品は 1 か所でしか使わないので `__root.tsx` の中に書く。

## Complexity Tracking

違反なし。
