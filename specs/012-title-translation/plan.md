# Implementation Plan: 記事タイトルを固有名称を残して日本語に翻訳する

**Branch**: `012-title-translation` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-title-translation/spec.md`

## Summary

登録・編集画面の記事の編集モーダルで、タイトル欄の右端に翻訳ボタン (`translate.svg`) を置く。押すと管理者専用のサーバー関数 `translateTitle` が、タイトルの 1〜3 語の候補を clef の `noul` で「固有名称か」と 1 回の要求で聞いて固有名称を決め、その語を `<span translate="no">` で囲んだ HTML を Cloud Translation - Basic (v2、API キー) で日本語にする。返った HTML から語が原文どおり残っているかを確かめ、通ったものだけをタイトル欄に入れ、「確定」で候補のタイトルになる。翻訳の状態はモーダルの state だけにあり、保存の形・backend・DB・OpenAPI は変えない。抽出と翻訳は別の関数にし、判定は #105 の呼び出し側で挟む。

## Technical Context

**Language/Version**: TypeScript (strict)、React 19

**Primary Dependencies**: TanStack Start (サーバー関数)、Zod、React Aria Components、Workers AI (`AI` binding、`@cf/cloudflare/clef`)、Cloud Translation - Basic (v2 REST、`fetch`)。新しい依存は足さない

**Storage**: N/A (編集モーダルの state だけ。保存の形と board は変えない)

**Testing**: Vitest (候補の切り出し、重なりの整理、HTML の組み立てと戻し、語の確認、再試行)

**Target Platform**: Cloudflare Workers (`nodejs_compat`、シークレットは `process.env`)

**Project Type**: web (frontend だけを変える)

**Performance Goals**: 1 件あたり数秒以内 (clef 1 回 + 翻訳 1 回。spec SC-003)

**Constraints**: API キーはサーバーだけに置く。ローカルの vite dev には clef が無く、翻訳を押せない

**Scale/Scope**: 1 日約 10 件 (約 300 件/月)。clef は 1 回 数百 token で $0.24/M token、翻訳は 1 件 100 文字前後

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec → plan → tasks の順。実装は承認後 |
| II. 契約ファースト | ✅ | backend を変えない。外部 API の答えは Zod で `parse` する |
| III. サーバー関数経由 | ✅ | clef と翻訳はサーバー関数の中から呼ぶ。入力は `.validator(z.object(...))`。API キーはブラウザに渡さない |
| IV. 最小実装 | ✅ | 依存を足さない。HTML のパーサーを入れず、自分で組んだタグだけを外す (research R4)。候補の上限 64 は `ponytail:` で残す |
| V. テストとスキーマ | ✅ | 入力は Zod、clef と翻訳の答えも Zod。分岐 (候補・重なり・語の確認・文字参照・状態の移り方) は Vitest で押さえる |

Phase 1 の設計の後も違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/012-title-translation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/translate-title.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── shared/
│   │   ├── api/
│   │   │   ├── title-terms.server.ts            # 候補の切り出し、clef の noul、重なりの整理 → extractTerms
│   │   │   ├── title-terms.server.test.ts
│   │   │   ├── title-translation.server.ts      # HTML の組み立て、v2 の呼び出し、戻しと語の確認 → translateWithTerms
│   │   │   ├── title-translation.server.test.ts
│   │   │   ├── retry.server.ts                  # 最大 3 回、RetryableError だけ再試行
│   │   │   ├── workers-ai.server.ts             # clef の読み込み (011 のカテゴリ推定と共有)
│   │   │   ├── translate-title.ts               # サーバー関数 translateTitle (requireAdminToken + 2 つを順に呼ぶ)
│   │   │   └── index.ts                         # translateTitle を export
│   │   └── ui/icons/translate.tsx               # translate.svg の写し (元のファイルは消す)
│   └── pages/digest-editor/
│       └── ui/
│           ├── draft-card.tsx                   # EditDialog のタイトル欄の右端に翻訳ボタン、翻訳の状態
│           └── draft-card.module.css            # 入力欄の型 (欄とボタンを同じ枠に入れる)
└── wrangler.toml                                # 変えない (AI binding は 011 で入っている。シークレットはダッシュボード)
docs/tech-stack.md                               # AI の行に翻訳を足す、GOOGLE_TRANSLATE_API_KEY を足す
adr/frontend/0012-*.md                           # clef の noul で固有名称を決め、v2 の API キーで翻訳する
```

**Structure Decision**: 011 と同じく `shared/api` に `*.server.ts` を置き、サーバー関数は薄くする。抽出と翻訳のファイルを分けるのは、#105 が両方を個別に呼ぶため (research R6)。

### 共通の再試行

clef と翻訳の両方で「最大 3 回、通信の例外と 5xx だけ再試行」(research R5) を使うので、`shared/api` に小さな `retry` 関数を 1 つ置き、2 か所から呼ぶ。

## 実装の前に確かめること

1. 実際の API キーで v2 に `<span translate="no" class="notranslate">` を含む HTML を送り、語が残るかと、返る文字参照の形を確かめる (research R3)。残らなければプレースホルダー方式に切り替え、research R3 と contract を直す。
2. clef の `noul` で、`React` `TypeScript` `TanStack Start` `npm` が「はい」に、`Building` `Apps` が「いいえ」に寄るかを確かめる。寄らなければ質問の言い回しを直す。

どちらもデプロイ先 (プレビュー) か、キーを使った手元の 1 回のリクエストで確かめる。GCP と Cloudflare の設定は管理者がコンソールで行う。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| アイコンが animate-ui ではない (UI ルールのアイコンの型) | 管理者が `translate.svg` を指定した | animate-ui に翻訳のアイコンが無く、行のボタンで動かす必要もない |
