---

description: "Task list for 001-digest-builder (記事登録画面の本実装)"
---

# Tasks: 記事登録 (Digest 作成) 画面

**Input**: `specs/001-digest-builder/` の plan.md / spec.md / research.md / data-model.md / contracts/server-functions.md / quickstart.md

**Tests**: constitution V に従い、分岐のある純粋関数に Vitest、画面の主経路に Playwright 1 本を書く。テスト名は仕様の言葉で書き (quality.md)、1 ロジック 1 テストに留める。

**Organization**: spec の優先度順 (US1 P1 → US2 / US3 / US5 P2 → US4 P3)。US5 (登録) は US1 で作った候補を手で分類しなくても、US2 のドラッグがあれば検証できる。

**パスの基点**: 特記がなければ `frontend/`。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで、未完了のタスクに依存しない
- **[Story]**: spec の User Story (US1〜US5)

---

## Phase 1: Setup

- [X] T001 `frontend/` で `pnpm add @dnd-kit/react@0.5.1 @dnd-kit/helpers@0.5.1` を実行し、`frontend/package.json` に `^` なしの固定版で入っていること、`pnpm-lock.yaml` が更新されたことを確認する (research R1)

---

## Phase 2: Foundational (全 Story の前提)

**目的**: トップと共有する部品を `shared` に上げ、候補の型と 2 カラムの骨組みを作る。トップの見た目・挙動は変えない。

- [X] T002 [P] `src/pages/home/model/parse-link-preview.ts` とそのテスト (`parse-link-preview.test.ts`、あれば) を `src/shared/lib/parse-link-preview.ts` へ移し、`src/pages/home` 内の import を書き換える
- [X] T003 [P] `src/pages/home/ui/preview-card.tsx` の `Favicon` (と `faviconUrl`、`fallback-favicon.svg`、`.favicon` のスタイル) を `src/shared/ui/favicon.tsx` / `favicon.module.css` / `fallback-favicon.svg` へ移し、`src/pages/home/ui/digest.tsx` と `preview-card.tsx` の import を書き換える。既存のコメント (sz=32、Google の既定画像の判定) は移した先に残す
- [X] T004 `src/pages/home/api/get-link-preview.ts` から「`MAX_BYTES` / `ttlOf` / `charsetOf` / `decode` / `readHead` / `cachedJson` を使った fetch + `parseLinkPreview`」を `src/shared/api/link-preview.server.ts` の `loadLinkPreviewCached(url: string): Promise<LinkPreview | null>` に移す (T002 の後)。キャッシュキー `https://cache.times.invalid/preview/v2/${encodeURIComponent(url)}` は変えない。`getLinkPreview` は `digestHasUrl` のガードを残してこれを呼ぶだけにする。`src/shared/api/index.ts` には足さない (`.server.ts` を barrel に増やさない)
- [X] T005 [P] `src/pages/digest-new/model/board.ts` に data-model.md の型を書く: `BoxId = "未分類" | Category`、`FetchState = "loading" | "done" | "failed"`、`Link { id; url; title; initial: { url; title }; fetch }`、`Draft extends Link { hot; children: Link[] }`、`Board = Record<BoxId, Draft[]>`。`boxIds` (未分類 → `category.options` の順) と `emptyBoard()` も置く
- [X] T006 `src/pages/digest-new/ui/box.tsx` + `box.module.css` を作る (T005 の後): 見出し (`.t-label` の箱名 + 件数 `.t-meta`、0 件でも出す) と開閉ボタン (`aria-expanded`、grid の高さ補間、`pages/home/ui/collapsible-panel` と同じ型)。枠は境界線 + `--radius-control`。中身は `children` で受ける。この時点ではドラッグを付けない
- [X] T007 `src/pages/digest-new/ui/digest-new-page.tsx` + `.module.css` を書き直す (T006 の後): 既存の行フォームを消し、2 カラムの grid (左: 日付 → URL 入力欄の場所 → 未分類の箱 → 登録の場所、右: 6 カテゴリの箱) にする。左カラムは強調面 (`--color-brand-faint`) で `position: sticky`。`@media (--narrow)` で 1 カラムに積む。`useState<Board>(emptyBoard)` を持つ。日付の既定値の扱い (`useSyncExternalStore` + `sv-SE`) は既存のコードとコメントを残す

**Checkpoint**: `just fe-typecheck` が通り、トップのプレビューと favicon が以前どおり出る。登録画面に空の箱 7 つが並ぶ。

---

## Phase 3: User Story 1 - 記事を集める (P1) 🎯 MVP

**Goal**: URL を貼って Enter するたびに、タイトル付きの候補が未分類に溜まる。

**Independent Test**: URL を 3 件連続で貼り、未分類に 3 件がタイトル・ドメイン・favicon 付きで並ぶ。

- [X] T008 [P] [US1] `src/pages/digest-new/model/board.ts` に `findDuplicate(board, url, exceptId?)` (記事と関連記事のすべての URL と完全一致)、`addDraft(board, url, id)` (未分類の末尾に `status: "loading"`、`title: ""`。重複なら `"duplicate"`、記事が全箱合計で 100 件なら `"limit"`)、`settleTitle(board, id, title: string | null)` (`status` を `done` / `failed` にし `initial` を確定。id がなければ board をそのまま返す) を書く
- [X] T009 [P] [US1] `src/pages/digest-new/api/fetch-draft-title.ts` に `fetchDraftTitle` を作る (contracts/server-functions.md): `createServerFn({ method: "POST" }).validator(newChildArticle.shape.url)`、handler で `readAdminToken()` が空なら `notFound({ data: { reason: SESSION_EXPIRED } })`、`loadLinkPreviewCached(url)` の `title` を `{ title: string | null }` で返す。import は `create-digest.ts` と同じく validator 用は `#/shared/api/schemas` から
- [X] T010 [P] [US1] `src/pages/digest-new/ui/draft-card.tsx` + `.module.css` を作る: 行頭に `Favicon` (`#/shared/ui/favicon`)、タイトル (`.t-title`、`font-family: var(--font-dynamic)`、`target="_blank"` のリンク)、ドメイン (`.t-meta`)。`status === "loading"` は「取得中…」、`failed` かタイトル空は「タイトルを入れてください」を muted で出す。カードは `--color-surface` + 境界線 + `--radius-card`
- [X] T011 [US1] `src/pages/digest-new/ui/digest-new-page.tsx` に URL 入力を作る (T008〜T010 の後): `<form>` + `<input type="url" required maxLength={2000}>` + 送信ボタン。submit で `addDraft` → 入力欄を空に → `fetchDraftTitle` → `settleTitle`。取得中は入力欄とボタンを `disabled` にし、終わったら入力欄にフォーカスを戻す。重複・上限・`http(s)` 以外はフォームの下に短く出す (例:「その URL はもう入ってます」)。未分類の箱に `DraftCard` を並べる
- [X] T012 [US1] `src/pages/digest-new/model/board.test.ts` に、重複した URL (関連記事の URL を含む) を追加できないこと、記事 100 件で追加できないこと、取得に失敗した候補はタイトル空のまま `initial` が確定すること、の 3 件を書く

**Checkpoint**: quickstart の手動確認 1〜3 が通る。

---

## Phase 4: User Story 2 - 振り分けて並べる (P2)

**Goal**: ハンドルで記事を箱の間・箱の中でドラッグでき、キーボードでも同じ操作ができる。

**Independent Test**: 未分類 → カテゴリ、カテゴリ間、カテゴリ → 未分類、箱内の入れ替えをドラッグとキーボードで行い、件数が即時に変わる。

- [X] T013 [P] [US2] `src/pages/digest-new/model/board.ts` に `toIds(board): Record<BoxId, string[]>` と `fromIds(board, ids): Board` を書く。`fromIds` は中身の変わらない箱の配列参照を使い回し、未知の id は例外にする (research R2)
- [X] T014 [US2] `src/pages/digest-new/ui/digest-new-page.tsx` を `DragDropProvider` (`@dnd-kit/react`) で包み、`onDragOver` で `move(toIds(board), event)` (`@dnd-kit/helpers`) を呼ぶ。返り値が入力と同じ参照なら何もしない。違えば `setBoard(fromIds(board, next))`
- [X] T015 [US2] `src/pages/digest-new/ui/box.tsx` に `useDroppable({ id: boxId })` を付け、`memo` で包む。ドラッグ中は枠の色を濃くし、閉じた箱でも見出しに落とせるようにする (Edge Cases)
- [X] T016 [US2] `src/pages/digest-new/ui/draft-card.tsx` に `useSortable({ id, index, group: boxId })` を付ける。左端にハンドル (`<button type="button" aria-label="並べ替え">⠿</button>`) を置いて `handle` に渡す (research R3)。ドラッグ中のカードは境界線の色と小さな影で示す (UI ルール: 状態は線・濃淡・小さな影だけ)
- [X] T017 [US2] `src/pages/digest-new/model/board.test.ts` に、`fromIds` が箱をまたいだ移動で記事の中身 (hot・関連記事) を保つこと、中身の変わらない箱は同じ配列参照を返すこと、の 2 件を書く

**Checkpoint**: quickstart の手動確認 4〜6 が通る。

---

## Phase 5: User Story 3 - 手直し (P2)

**Goal**: `···` メニューから編集・ホット・取得直後に戻す・削除ができる。

**Independent Test**: 訂正の確定と中断、戻す、ホット、削除がそれぞれ spec どおりになる。

- [X] T018 [P] [US3] `src/pages/digest-new/model/board.ts` に `editLink(board, id, { url, title })` (記事・関連記事どちらも。`findDuplicate(board, url, id)` に当たれば `{ error: "duplicate" }`)、`revert(board, id)` (`url` / `title` を `initial` に戻す。箱・位置・`hot`・`children` は変えない)、`toggleHot(board, id)` (記事のみ)、`remove(board, id)` (記事なら関連記事ごと、関連記事なら親から外す) を書く
- [X] T019 [US3] `src/pages/digest-new/ui/draft-card.tsx` に `···` ボタンと `popover="auto"` のメニュー (`role="menu"`、CSS anchor positioning、`--shadow-menu` + `--radius-control` + `--color-surface`) を付ける。項目: 編集 / ホットにする・ホットを外す / 取得直後に戻す / 削除。関連記事を持つ記事の削除は `window.confirm(\`関連記事 ${n} 件も消えます\`)` で確認する (research R6, R9)
- [X] T020 [US3] `src/pages/digest-new/ui/draft-card.tsx` に編集状態を作る: タイトル (`maxLength={300} required`) と URL (`type="url" maxLength={2000} required`) の入力欄、`<form>` の submit で `editLink`、「やめる」ボタンと Esc で破棄。重複はその場に短く出す。ホットの記事はタイトルの後ろに炎のアイコン (`pages/home/ui/icons/flame.tsx` を `shared/ui/icons/` に移して使う) を出す
- [X] T021 [US3] `src/pages/digest-new/model/board.test.ts` に、取得直後に戻してもホットと関連記事と位置が保たれること、編集で他の候補と同じ URL にできないこと、の 2 件を書く

**Checkpoint**: quickstart の手動確認 7 が通る。

---

## Phase 6: User Story 5 - Digest として登録する (P2)

**Goal**: 条件を満たした候補一式を登録し、トップへ移る。

**Independent Test**: 全候補を分類して登録し、トップに配置どおり表示される。

- [X] T022 [P] [US5] `src/pages/digest-new/model/board.ts` に `blockers(board)` (`{ kind: "empty" } | { kind: "unclassified"; count } | { kind: "untitled"; ids } | { kind: "loading" }` の配列。タイトル空は関連記事も含めて `title.trim() === ""` で判定) と `toNewDigest(board, entryDate): NewDigest` (未分類を除き、`category.options` の順 → 箱内の順 → 関連記事の順。`id` / `initial` / `status` を捨てる) を書く
- [X] T023 [US5] `src/pages/digest-new/ui/digest-new-page.tsx` の左カラム下端に登録ボタンを置く: `blockers` が空でないときは `disabled` にし、理由をボタンの横に短く出して `aria-describedby` で結ぶ (例:「未分類が 2 件残ってます」)。タイトル空の候補はカード側の表示 (T010) で分かる。クリックで `createDigest({ data: toNewDigest(board, entryDate) })`。失敗時は research R10 の 2 通りの文言を出し、候補は残す
- [X] T024 [US5] `src/pages/digest-new/ui/digest-new-page.tsx` に離脱確認を付ける: `useBlocker({ shouldBlockFn: () => !window.confirm("登録してない記事があります。移動しますか？"), enableBeforeUnload: () => hasDrafts && !submitting, disabled: !hasDrafts || submitting })` (research R8)。`submitting` は登録の開始で立て、失敗で下ろす
- [X] T025 [US5] `src/pages/digest-new/model/board.test.ts` に、`toNewDigest` が未分類を除いてカテゴリの固定順・箱内の順・関連記事の順で並べること、`blockers` が未分類・タイトル空の関連記事・取得中をそれぞれ返すこと、の 2 件を書く

**Checkpoint**: quickstart の手動確認 9〜11 が通る。ここまでで仮実装を置き換えられる。

---

## Phase 7: User Story 4 - 関連記事をまとめる (P3)

**Goal**: メニューで関連記事にする・外す・上下移動ができ、親と一緒に動く。

**Independent Test**: B を A の関連記事にして A をドラッグすると B も移る。外すと A の直後に戻る。

- [X] T026 [P] [US4] `src/pages/digest-new/model/board.ts` に `canMakeChild(board, id)` (箱の先頭でない・自分の `children` が空・上の記事の `children.length < 20`)、`makeChild(board, id)` (上の記事の `children` の末尾へ。`hot` と `children` を捨てる)、`unmakeChild(board, parentId, childId)` (親の直後に `hot: false, children: []` で戻す)、`moveChild(board, parentId, childId, -1 | 1)` (端では何もしない) を書く
- [X] T027 [US4] `src/pages/digest-new/ui/draft-card.tsx` で `children` を親カードの中に、左 1px 線 (`--color-border`) でインデントして描く。関連記事は sortable にせずハンドルを出さない。関連記事のメニュー: 編集 / 上へ / 下へ / 関連記事から外す / 取得直後に戻す / 削除。記事のメニューに「関連記事にする」を足し、`canMakeChild` が false なら `disabled`
- [X] T028 [US4] `src/pages/digest-new/model/board.test.ts` に、箱の先頭・関連記事を持つ記事・上の記事が 20 件持つ場合は関連記事にできないこと、外すと親の直後に戻ること、の 2 件を書く

**Checkpoint**: quickstart の手動確認 8 が通る。

---

## Phase 8: Polish

- [X] T029 `e2e/digest-new.spec.ts` を書き直す: 未ログインの 404 テストは残す。主経路を 1 本: 日付 `2099-12-31` → `https://e2e.example/${run}/1〜3` を貼る (到達できないのでタイトル空になる) → 各カードを編集してタイトルを入れる → ハンドルを `locator.dragTo` でセキュリティ / その他へ動かす → 3 件目をホット → 2 件目を 1 件目の関連記事にする → 登録 → トップで見出しの順・リンクの順・HOT の印を確認する
- [X] T030 [P] `TODO.md` の `specs/001-digest-builder` の行を更新する (tasks まで済み、本実装の状況)。`minimal-digest-plan.md` を消すかどうかもその行に書く
- [X] T031 `just lint && just test`、`just fe-typecheck`、`just fe-test-e2e` を通す。quickstart の手動確認 12 (狭い画面) をブラウザで確かめる

---

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002〜T007) → 各 Story。
- T004 は T002 の後。T006 → T007。
- US1 (Phase 3) は他の Story の前提 (候補がないと何も試せない)。
- US2 / US3 / US5 は US1 の後ならどの順でもよい。ただし `draft-card.tsx` / `digest-new-page.tsx` / `board.ts` を共有するので、同時に進めるならファイル単位で分ける。US5 を US2 より先にやる場合は、検証のために未分類以外の箱へ入れる手段が要るので、US2 → US5 の順を推奨する。
- US4 は US3 (メニュー) の後。
- T029 は全 Story の後。

## Parallel Opportunities

- Foundational: T002 / T003 / T005 は同時に進められる。
- US1: T008 (model)・T009 (server fn)・T010 (card) は別ファイル。
- 各 Story の model タスク (T013, T018, T022, T026) は `board.ts` の別の関数なので、UI の作業と並べて進められる。

## Implementation Strategy

1. Setup + Foundational で骨組みを作り、トップが壊れていないことを確認する。
2. US1 → US2 → US5 で「集める → 振り分ける → 登録」が通る。ここで仮実装を置き換えられる (実用上の MVP)。
3. US3 (手直し) → US4 (関連記事) を足す。
4. e2e を書き直して完了判定 (quality.md) を通す。
