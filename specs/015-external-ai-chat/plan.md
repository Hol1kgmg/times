# Implementation Plan: 記事を外部の AI チャットで解説してもらう

**Branch**: `015-external-ai-chat` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-external-ai-chat/spec.md`

## Summary

`DigestPost` の記事行 (親・子) に、記事リンクとは別の `AskAi` ボタン (`bot-message-square`) を置く。ボタンは記事リンクと 1 つのインライン要素 (ホバーの範囲) に入れ、DOM でも見た目と同じタイトル → ボタン → 炎の順に置く。幅はリンクの末尾で予約してその上に重ね、HOT の炎と吹き出しは普段その幅の上へ寄せておき、見せる間だけ戻す (research R3・R8)。押すと RAC の `DialogTrigger` のカードが開き、Claude / ChatGPT / Grok を `?q=` に依頼の文を入れたリンクで新しいタブに開くか、文をコピーする。ホバーできる環境では記事リンクからボタンまでのホバーとキーボードのフォーカスでボタンを見せ、ボタンのホバーでカードを開く (このときだけ非モーダルにしてフォーカスを移さない、research R2)。ホバーできない環境では、日付の線の右端に `AiToggle` を出し、ON の間だけ全行にボタンを見せる。状態はページで 1 つの `useState`。トップの Markdown のコピーボタンはホバーできる環境だけに出し、「コピーしました」は `CopyToast` に切り出して共用する。backend・DB・サーバー関数は変えない。

## Technical Context

**Language/Version**: TypeScript (strict)、React 19

**Primary Dependencies**: React Aria Components (`DialogTrigger` / `Popover` / `Dialog` / `Toolbar` / `Link` / `ToggleButton` / `Button`)、react-aria の `useHover` / `FocusScope`、`@animate-ui/react/icons` + `motion` (取り込み済み)。AI サービスのロゴは LobeHub の icons (MIT) からパスを写す。新しい依存は足さない

**Storage**: N/A (表示の ON / OFF はページのメモリだけ)

**Testing**: Vitest (`shared/lib/ai-chat.test.ts`: 文の形、URL の符号化の境界)。型 (編集画面のプレビューに `ai` を渡せない)。e2e は足さない (サーバー関数・SQL・セッションに触れない UI だけの変更)

**Target Platform**: PC・モバイルのブラウザ (Cloudflare Workers で配信)

**Project Type**: web (frontend だけを変える)

**Performance Goals**: 記事行が増えても描画の負担を増やさない。カードの中身は開いたときだけ描く (RAC の Popover の既定)

**Constraints**: アイコンの出し入れと炎のずれで、記事タイトルの位置・折り返し・行の高さを変えない (SC-003)。ずらすのはレイアウトを変えない指定 (`translate`) だけ。リンクの中にボタンを入れない。色・余白はトークンだけ。`:hover` を使わない (adr/frontend/0007)

**Scale/Scope**: 1 日約 20 記事。タイムラインでは日付の数だけトグルが並ぶ

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec → plan → tasks の順。実装は承認後 |
| II. 契約ファースト | ✅ | backend・OpenAPI・SQL を変えない。部品の受け渡しは `contracts/ui.md` |
| III. サーバー関数経由 | ✅ | backend を呼ばない。外部へはブラウザのリンクで移るだけ |
| IV. 最小実装 | ✅ | 依存を足さない。状態は `useState` 1 つ (Context なし)。`CopyToast` は 2 か所で同じ形が出るので上げる (R6)。タッチとマウスを両方持つ PC の上限は research に残す |
| V. テストとスキーマ | ✅ | 文と URL を作る分岐・符号化は Vitest。編集画面に出さないことは props の合併の型。見た目と操作 (ホバー・フォーカス・トグル) は quickstart で手で確かめる |

Phase 1 の設計の後も違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/015-external-ai-chat/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code (repository root)

```text
rules/frontend-ui-design.md            # HOT の節に AI のアイコンとのずらし、面と部品の型にアイコンボタンを足す (.agents/rules は Nix の生成物)
frontend/.markuplintrc.json            # allowAttrs に onPointerDownCapture / onKeyDownCapture を足す
frontend/src/
├── app/styles/global.css              # .icon-button を足す (R9)
├── shared/lib/
│   ├── ai-chat.ts                     # 新規: aiPrompt / aiChatUrl
│   ├── ai-chat.test.ts                # 新規: Vitest
│   └── reduced-motion.ts              # 新規: reducedMotion() (date-picker / sand-pile もこれを使う)
├── shared/ui/
│   ├── icons/bot-message-square.tsx   # 新規: animate-ui から取り込み
│   ├── icons/bot-off.tsx              # 新規: animate-ui から取り込み
│   ├── ask-ai.tsx / .module.css       # 新規: ボタン + カード + コピー
│   ├── ai-toggle.tsx / .module.css    # 新規: ホバーできない環境のトグル
│   ├── copy-toast.tsx / .module.css   # 新規: digest-card の「コピーしました」を移す
│   ├── icons/ai-brand.tsx             # 新規: Claude / ChatGPT / Grok のロゴ (LobeHub から写す)
│   ├── digest-post.tsx                # ai (合併の props)、リンクと AskAi を包むホバーの範囲 (.zone)、炎の前の WORD JOINER
│   ├── digest-post.module.css         # AskAi の出し入れ (R3)、AskAi と炎のずらし (R8)
│   └── digest-post.stories.tsx        # ai を渡す story を 1 つ足す
├── pages/home/ui/
│   ├── digest-card.tsx                # useState、action にコピーボタン + AiToggle、CopyToast を使う
│   └── digest-card.module.css         # toast の CSS を削り、コピーボタンをホバーできる環境だけに出す
├── pages/digest-timeline/ui/timeline-page.tsx  # useState、action に AiToggle
└── pages/not-found/ui/sand-pile.tsx、shared/ui/date-picker.tsx  # reducedMotion() に寄せる
```

**Structure Decision**: frontend の `shared` の中で閉じる。`AskAi` / `AiToggle` はトップとタイムラインの 2 ページで使うので `shared/ui` に置く。状態はページの部品が持ち、`DigestPost` は受け取るだけにする。

## Complexity Tracking

違反なし。ホバーで開くときだけ非モーダルに切り替える分岐 (research R2) は、ユーザーが決めたホバーで開く操作と、UI ルールのフォーカスの扱いを両立させるために要る。
