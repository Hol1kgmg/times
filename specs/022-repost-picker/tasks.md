# タスク: 過去の記事を検索して再掲載の行として足す (issue #171)

**入力**: `specs/022-repost-picker/` の spec.md・plan.md (research・data-model・contracts は作らない)

**テスト**: plan.md の「テスト」に従い、Vitest 3 件と e2e 1 本だけ書く。

パスは `frontend/src/` からの相対。e2e は `frontend/e2e/`。

## Phase 1: 基盤

- [x] T001 `shared/api/repost-candidates.ts` に `listRepostCandidates` を足し、`shared/api/index.ts` から出す。形は `shared/api/search-articles.ts` にそろえ、`requireAdminToken` で呼び、`.validator(articleSearchQuery)` (`q: z.string().trim().min(1).max(100)`)、返り値は `repostCandidateList.parse` を通す。登録したばかりの記事も探せるようキャッシュは通さない (FR-001)

**チェックポイント**: `just fe-typecheck` が通る

## Phase 2: US1 タイトルか URL の一部から記事を探して再掲載の行にする (P1) 🎯 MVP

**目標**: 検索 1 回と選択 1 回で過去の記事を再掲載の行にして保存できる (SC-001)

**独立したテスト**: 公開した記事を別の日の登録画面で検索して選び、公開して開き直すと再掲載の行として並ぶ

- [x] T002 [US1] `pages/digest-editor/model/board.ts` に `addRepost(board, candidate, id): Board | Rejected` を足す。上限 (`MAX_DRAFTS` = 100) と重複は `rejectAdd` で断り (FR-007)、行は `convertToReposts` が作る形 (`repost: { category, firstPublishedOn }`、`hot: false`、子なし) で候補のカテゴリの枠に入れる。子の候補も単独の行にする (FR-005・FR-006)
- [x] T003 [US1] `pages/digest-editor/model/board.test.ts` に「選んだ記事は元のカテゴリの枠で `{ repostOf, category }` として送られる」を 1 件足す (`addRepost` → `toNewDigest`)
- [x] T004 [US1] `pages/digest-editor/ui/repost-picker.tsx` (+ `repost-picker.module.css`) を足す。`ModalDialog` (外側のクリックでも閉じる)、素の `<input type="search" required maxLength={100}>` の `<form>` で送信時だけ `listRepostCandidates` を呼ぶ。開いたら検索欄にフォーカスする。結果は React Aria Components の `ListBox` に並べ、行はタイトル (favicon 付き)・URL のドメイン・カテゴリ・「〜に初掲載」、子なら親のタイトルを上に小さく出す (FR-003)。押すと `addRepost` して閉じる。0 件は「見つかりませんでした」(US1-4)、空白だけの語は zod で断られるので語を入れるよう出し、失敗はログイン切れとそれ以外を今の保存の文言にそろえる。色・余白はトークンだけ、文字は `var(--font-dynamic)`
- [x] T005 [US1] `pages/digest-editor/ui/digest-editor-page.tsx` の `UrlAddForm` の下に「過去の記事から追加」のボタン (ボタンの型) を置き、T004 を開く。日付が空 (FR-002) か `draftCount(board) >= MAX_DRAFTS` (FR-007) のときは押せない
- [x] T006 [US1] `e2e/digest-repost.spec.ts` に 1 本足す: 公開した記事を別の日の登録画面でタイトルの一部で検索して選び、公開して開き直すと「再掲載」の行として並ぶ。日付が 1 回の実行で 6 日から 8 日に増えるので、既存の `base` を `(Math.floor(run / 1000) % 9_000) * 8` に変え、`digest-edit.spec.ts` (1900 年から) に届かないようにする

**チェックポイント**: US1 の受け入れシナリオ 1〜4 が画面で通り、既存の URL を貼る 1 本目も通る (SC-003)

## Phase 3: US2 選べない記事と、その理由が分かる (P1)

**目標**: 載せ直せない候補は選べず、理由が読み上げで分かる (SC-002)

**独立したテスト**: Vitest の `repostBlock` の 2 件と、モーダルで選べない候補にドットと読み上げの文言が付くこと

- [x] T007 [US2] `pages/digest-editor/model/board.ts` に `repostBlock(board, candidate, entryDate): "not-before" | "on-board" | null` を足す。`firstPublishedOn >= entryDate` なら `"not-before"`、親でも子でも盤面に同じ URL があれば (`findDuplicate`) `"on-board"` (FR-004)。日付を変えた後の判定はしない (FR-008)
- [x] T008 [US2] `pages/digest-editor/model/board.test.ts` に「初掲載日が編集中の日付と同じなら選べず、前日なら選べる」を 1 件、「盤面の子の行にある記事は選べない」を 1 件足す
- [x] T009 [US2] `pages/digest-editor/ui/repost-picker.tsx` で `repostBlock` が null でない候補を `ListBox` の `disabledKeys` に入れ、`--color-brand` のドットと読み上げ用の文言 (「この日より前に公開されてないので選べません」「もう載ってるので選べません」) を `ListBoxItem` の中に置く。説明文は見た目に出さない (frontend-ui-design.md の「選べない理由」)。押せない行は `--color-text-faint` + `not-allowed`

**チェックポイント**: US2 の受け入れシナリオ 1・2 が画面で通る

## Phase 4: 仕上げ

- [x] T010 `just lint && just test && just fe-typecheck`
- [x] T011 quality.md の手順で backend を e2e 用に切り替え、`just fe-test-e2e digest-repost` を回す (終わったら `docker compose stop api` と開発用の起動し直し)

## 依存と順序

- T001 → T004 (サーバー関数を呼ぶ)
- T002 → T003、T002 → T004 → T005 → T006
- T007 → T008、T007 + T004 → T009
- US2 は T004 のモーダルの上に載るので US1 の T004 の後。T007・T008 は T001 の後ならいつでも
- T010・T011 は全部の後

## 並行できるもの

- T002/T003 (model) と T001 (shared/api) は別ファイルなので並行できる
- T007/T008 は T002/T003 と同じファイルなので並行しない

## 実装の進め方

1. T001 → US1 (T002〜T006) で MVP。この時点で検索 → 選択 → 保存がつながる
2. US2 (T007〜T009) で選べない候補を塞ぐ。保存時の backend の検証 (specs/018) があるので、US1 だけでも誤った保存は断られる
3. T010・T011 で完了を判定する
