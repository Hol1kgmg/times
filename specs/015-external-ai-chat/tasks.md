---

description: "Task list for 015-external-ai-chat"
---

# Tasks: 記事を外部の AI チャットで解説してもらう

**Input**: Design documents from `/specs/015-external-ai-chat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: constitution 原則 V と `.agents/rules/quality.md` に従う。依頼の文と URL を作る関数は Vitest で 1 ロジック 1 テスト。編集画面のプレビューに出さないことは props の型で押さえ、テストは書かない。見た目と操作は UI だけの変更なので e2e は足さず、quickstart.md の手順で手で確かめる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで依存がなく、並行してできる
- **[Story]**: 対応する User Story (US1〜US4)
- パスはリポジトリのルートからの相対

---

## Phase 1: Setup

- [X] T001 ブランチ `015-external-ai-chat` を `main` から切る (今の `feat/not-found-page` から切らない)

---

## Phase 2: Foundational

- [X] T002 [P] `frontend/src/shared/lib/ai-chat.ts` を作る。`type AiService = "claude" | "chatgpt"`、`aiPrompt({ title, url })` は data-model.md の固定の文 (「次の記事を日本語でわかりやすく解説してください。要点と背景、読むのに必要な用語を教えてください。記事を読めないときは、推測で答えずにその旨を教えてください。」+ 空行 + `タイトル: {title}` + `URL: {url}`) を返す。`aiChatUrl(service, prompt)` は Claude を `https://claude.ai/new`、ChatGPT を `https://chatgpt.com/` にして `q` を `URLSearchParams` で付ける。計測用のパラメータは付けない (FR-017)。title / url は再検証しない
- [X] T003 [P] `frontend/src/shared/lib/ai-chat.test.ts` を作る。(1) 文に記事のタイトルと URL が入ること、(2) 改行・`&`・`#` を含む文が `q` から元の文のまま読み戻せること、の 2 件。テスト名は仕様の言葉で書く
- [X] T004 [P] `frontend/src/shared/ui/icons/bot-message-square.tsx` を、ユーザーが貼った animate-ui の `BotMessageSquare` から既存の `frontend/src/shared/ui/icons/flame.tsx` と同じ形で作る (`'use client'` と `import * as React` を外す、値と型の import を分ける、export の並びを揃える)。`animations` はすべて残す

**Checkpoint**: `just lint && just test` が通る

---

## Phase 3: User Story 1 - PC の読み手が記事を AI チャットで解説してもらう (Priority: P1) 🎯 MVP

**Goal**: ホバーできる環境で、記事行のホバー・フォーカスでアイコンが出て、ホバー・押下・キーボードでカードを開き、Claude / ChatGPT を開ける

**Independent Test**: quickstart.md「PC」の 1〜5・7・8

- [X] T005 [US1] `frontend/src/shared/ui/ask-ai.tsx` と `ask-ai.module.css` を作る (contracts/ui.md の `AskAi`。外側の要素に `className` を受ける)。RAC の `MenuTrigger` (`isOpen` / `onOpenChange` を自分で持つ) + `Button` (読み上げの名前 `「{title}」を AI で解説`、中身は `BotMessageSquare` 16px) + `Popover` (`placement="bottom start"`) + `Menu`。選択肢は `MenuItem` の `href={aiChatUrl(...)}`・`target="_blank"`・`rel="noopener noreferrer"` で「Claude で解説」「ChatGPT で解説」の 2 つ (コピーは US4)。ホバーで開いたときだけ `Popover` を `isNonModal`、`Menu` の `autoFocus` を切る。ボタンとカードのどちらかからホバーが外れたら 0.3s 後に閉じ、その間にどちらかへ戻れば取り消す (research R2)。アイコンはボタンの `isHovered` で `default` を 1 回動かし、`prefers-reduced-motion: reduce` では動かさない (R7)。ボタンは `inline-flex`・`height: 1lh`・`vertical-align: top` で `.hot` と同じ並びにし、地と枠を持たない `--color-text-muted` (ホバー・フォーカスで `--color-accent`、`[data-pressed]` で小さく縮める)。カードはメニューの型 (`--color-surface` + 境界線 + `--radius-control` + `--shadow-menu`)、選択肢はホバー・フォーカスで `--color-selected` の地と `--color-accent` の文字。開閉はフェード 0.2s ease-out、reduced-motion で止める
- [X] T006 [US1] `frontend/src/shared/ui/digest-post.tsx` の `DigestPostProps` の合併に、`Digest` の側は `aiShown?: boolean`、`DigestContent` の側は `aiShown?: never` を足す (contracts/ui.md、R5)。`ArticleLink` に `aiShown` を渡し、`aiShown !== undefined` のとき `{card}` の後ろに `<AskAi className={styles.askAi} title={article.title} url={article.url} />` を置く (リンクの中に入れない。`a + .preview` の隣接を崩さない)。行の `div` に `useHovered()` を広げ、`aiShown` が true のとき `data-ai-shown`、`hot` のとき `data-hot` を付ける
- [X] T007 [US1] `frontend/src/shared/ui/digest-post.module.css` に AskAi の出し入れとずらしを足す (R3・R8)。
  - 出し入れ: `.askAi` は普段 `visibility: hidden` + `opacity: 0` + `scale` で縮めた状態 (左端を軸) で、幅は取ったまま。`@media (--hover)` では `.row[data-hovered]`・`.row:focus-within`・開いている間 (`.row:has([aria-expanded="true"])`) に見せる。`@media not (--hover)` では `.row[data-ai-shown]` のときだけ見せる。`:hover` は使わない
  - ずらし: 幅を `--ask-ai-width` (AskAi のアイコン 16px + 左の余白のトークン) と `--hot-width` (今の `.hot` の margin-left + 炎 16px + gap + 吹き出しの幅) の custom property にして `.row` に置き、`.hot` と `.askAi` の `width` にも使う。見せる条件と同じとき、`.row[data-hot] .askAi` を `translateX(calc(-1 * var(--hot-width)))`、`.row[data-hot] .hot` を `translateX(var(--ask-ai-width))` にする。HOT のない行の `.askAi` はずらさない
  - 動き: 出現とずれは 0.2s ease-out。`prefers-reduced-motion: reduce` では transition を止める (既存の `.hotLabel` の指定に並べる)
  - 生の px はアイコンの大きさだけにし、余白はトークンで書く
- [X] T008 [US1] `frontend/src/pages/home/ui/digest-card.tsx` と `frontend/src/pages/digest-timeline/ui/timeline-page.tsx` で、`DigestPost` に `aiShown={false}` を渡す (US2 で状態に置き換える)
- [X] T009 [P] [US1] `frontend/src/shared/ui/digest-post.stories.tsx` に `aiShown` を渡した story を 1 つ足す

**Checkpoint**: `just fe-typecheck` が通り、quickstart.md「PC」の 1〜5・7・8 が手で確かめられる。Claude と ChatGPT が実際に文の入った状態で開くかも、ここで確かめる (research R1)

---

## Phase 4: User Story 2 - ホバーできない環境の読み手がトグルでアイコンを出して使う (Priority: P1)

**Goal**: ホバーできない環境で、日付の線の右端のトグルを ON にすると全記事行にアイコンが出て、タップでカードを開ける

**Independent Test**: quickstart.md「ホバーできない環境」の 1〜4

- [X] T010 [P] [US2] `frontend/src/shared/ui/icons/bot-off.tsx` を、ユーザーが貼った animate-ui の `BotOff` から T004 と同じ形で作る
- [X] T011 [US2] `frontend/src/shared/ui/ai-toggle.tsx` と `ai-toggle.module.css` を作る (contracts/ui.md の `AiToggle`)。RAC の `ToggleButton` で、読み上げの名前は状態によらず「AI のアイコンを表示」。OFF は `BotOff` を `--color-text-muted`、ON は `BotMessageSquare` を `--color-accent` (20px、トップのコピーボタンと同じ大きさ)。切り替えのたびに新しい状態のアイコンを 1 回動かす (OFF は `off` の動き、ON は `default`)。reduced-motion では動かさない。`@media (--hover)` では `display: none`
- [X] T012 [US2] `frontend/src/pages/home/ui/digest-card.tsx` に `const [aiShown, setAiShown] = useState(false)` を足し、`DigestPost` に `aiShown` を、`action` にコピーボタンと `<AiToggle isSelected={aiShown} onChange={setAiShown} />` を並べて渡す。`frontend/src/pages/home/ui/digest-card.module.css` でコピーボタン (`.copyWrap`) を `@media not (--hover)` で `display: none` にする (FR-011)

**Checkpoint**: DevTools でタッチにして、quickstart.md「ホバーできない環境」の 1〜4 が確かめられる。PC ではトグルが出ずコピーボタンが出る

---

## Phase 5: User Story 3 - タイムラインでは全日付のトグルが同じ状態になる (Priority: P2)

**Goal**: タイムラインの全日付のトグルとアイコンが 1 つの状態で切り替わる

**Independent Test**: quickstart.md「ホバーできない環境」の 5

- [X] T013 [US3] `frontend/src/pages/digest-timeline/ui/timeline-page.tsx` の `TimelinePage` に `const [aiShown, setAiShown] = useState(false)` を足し、各 `DigestPost` に `aiShown={aiShown}` と `action={<AiToggle isSelected={aiShown} onChange={setAiShown} />}` を渡す (R4)

**Checkpoint**: タイムラインで 1 つのトグルを押すと全日付が切り替わる

---

## Phase 6: User Story 4 - AI チャットを開けないときにプロンプトをコピーして使う (Priority: P2)

**Goal**: カードの「プロンプトをコピー」で依頼の文をコピーでき、成功したときだけ「コピーしました」が出る

**Independent Test**: quickstart.md「PC」の 6

- [X] T014 [US4] `frontend/src/shared/ui/copy-toast.tsx` と `copy-toast.module.css` を作り、`frontend/src/pages/home/ui/digest-card.tsx` の `<output>` と `digest-card.module.css` の `.copyWrap` / `.toast` / `.toastText` / `@keyframes toast-in` / reduced-motion の指定をそこへ移す (contracts/ui.md の `CopyToast`、R6)。`--copy` のアンカーは `anchor-scope` で `CopyToast` の外側の要素に閉じる。`digest-card` のコピーボタンは `CopyToast` で包む形に書き換え、見た目と振る舞いを変えない
- [X] T015 [US4] `frontend/src/shared/ui/ask-ai.tsx` の `Menu` に「プロンプトをコピー」を足し、`navigator.clipboard.writeText(aiPrompt(...))` が成功したら `CopyToast` を 2 秒出す。`NotAllowedError` だけは示さずに握りつぶし (理由を 1 行コメント)、ほかのエラーは投げ直す (typescript-app.md「無視してよいエラー」)。ボタンを `CopyToast` で包む

**Checkpoint**: コピーした文を貼ると「Claude で解説」で入る文と同じ。トップの Markdown のコピーボタンも前と同じに動く

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T016 `just lint && just test` と `just fe-typecheck` を通す。e2e は回さない (サーバー関数・backend・SQL・セッションに触れない)
- [X] T017 quickstart.md の手順をすべて手で確かめる。HOT の記事・行末ぎりぎりで折り返すタイトル・子記事で、アイコンの出し入れ・炎のずれ・トグルの前後にタイトルの位置・折り返し・行の高さが変わらないこと (SC-003)、HOT の炎と吹き出しの動きで AI のアイコンが押されないこと、編集画面のプレビューに出ないこと、reduced-motion で動かないことを含める
- [X] T018 [P] 実装で `rules/frontend-ui-design.md` の決まり (2026-11-10 に追記済み: HOT の節の AI のアイコンとのずらし、Digest の投稿の節の AI のアイコンとトグル) と食い違いが出たら、どちらに寄せるかをユーザーに確かめる (`.agents/rules` は Nix の生成物なので直接書かない)
- [X] T019 [P] `TODO.md` に関係する項目があれば、日付と要点を添えて `[x]` にする (消さない)

---

## Phase 8: Refactor (2026-11-11)

**Purpose**: ホバーの判定の範囲と配置を整理し、重複を減らす。T005〜T015 の記述のうち、`MenuTrigger` + `Menu` (→ `DialogTrigger` + `Toolbar`、サービスは Grok を足して 3 つ)、`aiShown`、AskAi の `left` での寄せ、0.1s の待ち、`onHoverChange` はここで置き換えた。今の形は research R2・R3・R5・R8・R9 と contracts/ui.md が正

- [X] T020 `digest-post.tsx` で記事リンク・プレビュー・AskAi を `.zone` で包み、`useHover` を付ける。`pointerIn` と 0.1s の待ち、`AskAi` の `onHoverChange` を消す。DOM の順をタイトル → AskAi → 炎にし、間に WORD JOINER を挟む (R3・R8)
- [X] T021 `digest-post.module.css` で AskAi の幅の予約を `.title::after` の 1 か所にし、炎は普段 `translate` で予約の上へ寄せる。`left: -hotWidth`・`.hot` の `padding-right`・`data-hot`・`data-pointer-in` を消し、見せる条件を 1 つのセレクタにまとめる (R3・R8)
- [X] T022 押したときの縮みをカードが開いていない間に限る。縁でカードが開閉を繰り返す不具合を直す (R2)
- [X] T023 markuplint のエラーを直す: `onPointerDownCapture` / `onKeyDownCapture` を `allowAttrs` に足し、`Link` の `autoFocus` を `FocusScope autoFocus` に置き換える (R2)
- [X] T024 `global.css` に `.icon-button` を足し、コピー・トグル・AI のアイコンのボタンで取り込む (R9)
- [X] T025 `AskAi` の `byMouse` の state と `data-mouse` を消す (T022 で開いている間は縮まなくなったため)
- [X] T026 `date-picker.tsx` と `not-found/ui/sand-pile.tsx` の `matchMedia` を `reducedMotion()` に寄せる (R7)
- [X] T027 `DigestPost` の `aiShown?: boolean` を `ai?: { shown: boolean }` にし、呼び出し側と story を合わせる (R5)
- [X] T028 `rules/frontend-ui-design.md` の HOT の項・AI のアイコンの項を今の形に直し、面と部品の型にアイコンボタンを足す (`.agents/rules` は rules.nix からの再生成が別に要る)
- [X] T029 `just fe-lint`・`just fe-lint-markup`・`just fe-typecheck`・Vitest を通す

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3。US4 は US1 の後ならいつでもよい
- US1 が `AskAi` と `digest-post` の受け口を作り、US2 がそこに状態とトグルを付ける。US3 は US2 の `AiToggle` を使う
- T014 (`CopyToast` の切り出し) は `digest-card.tsx` を触るので、T012 の後にする

## Parallel Opportunities

- Phase 2: T002 / T003 / T004 は別ファイルで並行できる (T003 は T002 の公開する名前だけを前提にする)
- US1: T009 は T006 の後なら T007・T008 と並行できる
- US2: T010 は Phase 2 の後ならいつでもできる
- Polish: T018 / T019 は並行できる

## Implementation Strategy

1. **MVP**: Phase 1〜3 (US1)。PC で Claude / ChatGPT を開けるところまで。ここで外部の URL が実際に効くかを確かめ、効かなければ US4 (コピー) を先に回す
2. US2 でモバイルに広げ、US3 でタイムラインに広げる
3. US4 でコピーと「コピーしました」の共通化を入れる
4. 各 Checkpoint で止まり、ユーザーに報告してから次へ進む (コミットは頼まれたときだけ)
