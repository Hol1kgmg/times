---

description: "Task list for 011-auto-category"
---

# Tasks: 記事のカテゴリを AI で推定して振り分ける

**Input**: Design documents from `/specs/011-auto-category/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/suggest-category.md

**Tests**: constitution 原則 V と `.agents/rules/quality.md` に従い、分岐のあるロジックにだけ Vitest を 1 件ずつ書く。e2e は書かない (保存の形と backend との受け渡しを変えないため)。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで依存がなく、並行してできる
- **[Story]**: 対応する User Story (US1, US2)
- パスはリポジトリのルートからの相対

---

## Phase 1: Setup

- [X] T001 `frontend/wrangler.toml` に `[ai]` と `binding = "AI"` を足す。「Workers AI (clef) でカテゴリを推定する。ローカルの vite dev には無い (specs/011)」と、理由だけを 1 行のコメントで残す
- [X] T002 [P] `frontend/vite.config.ts` の `defineConfig` に `environments: { ssr: { build: { rollupOptions: { external: [/^cloudflare:/u] } } } }` を足す。コメントは「Workers の実行時にだけある組み込みモジュールで、ビルドでは解決できない」の 1 行
- [X] T003 [P] `frontend/src/shared/api/cloudflare-workers.d.ts` を作り、`declare module "cloudflare:workers" { export const env: Record<string, unknown>; }` だけを宣言する (`@cloudflare/workers-types` は入れない、research R4)

**Checkpoint**: `pnpm -C frontend build` と `just fe-typecheck` が通る

---

## Phase 2: Foundational

- [X] T004 `frontend/src/pages/digest-editor/model/board.ts` の `Draft` に `suggested: boolean` を足す。`addDraft`・`fromDigest`・`unmakeChild` で `false` にする。`makeChild` の分割代入は `{ url, title, initial, status }` のままにし、子記事に `suggested` を持たせない。`toNewDigest` は明示したフィールドだけを出すので、変えない (FR-006)。既存のテストと型が通るよう、`board.test.ts` などで `Draft` を組んでいる箇所を直す

**Checkpoint**: `just fe-typecheck` と `just test` が通る

---

## Phase 3: User Story 1 - 貼り付けた記事がカテゴリの箱に自動で入る (Priority: P1) 🎯 MVP

**Goal**: URL を追加すると、推定したカテゴリの箱の末尾に候補が入る。推定できないときは未分類に残る。

**Independent Test**: 本番で AI 系の記事の URL を追加し、「AI系」の箱に入ることを確かめる。ローカルでは未分類に残り、エラーが出ないことを確かめる (quickstart.md)。

### Tests for User Story 1

- [X] T005 [P] [US1] `frontend/src/shared/api/category-suggestion.server.test.ts` に、clef の答えをカテゴリに変える関数のテストを書く。テスト名は仕様の言葉にする。`it("returns the category when its probability is at least 0.5")` (0.5 ちょうどで返る)、`it("leaves the article unsorted below 0.5")` (0.49 で `null`)、`it("leaves the article unsorted when the answer is outside the fixed categories")`
- [X] T006 [P] [US1] `frontend/src/pages/digest-editor/model/board.test.ts` に `settleCategory` のテストを書く。`it("moves an unsorted draft to the end of the suggested category and marks it")`、`it("keeps a draft the admin already moved out of unsorted")`、`it("leaves the draft unsorted when no category is suggested")`

### Implementation for User Story 1

- [X] T007 [US1] `frontend/src/shared/api/category-suggestion.server.ts` を作る。中身は 3 つ。
  - (a) clef の答えの Zod スキーマ `{ type: z.literal("choice"), choice: z.string(), probabilities: z.record(z.string(), z.number()), confidence: z.number() }`
  - (b) 答えから `Category | null` を返す関数。`choice` が `category.safeParse` で通り、かつ `probabilities[choice] >= 0.5` のときだけ返す (research R2)
  - (c) `suggestCategoryWithAi({ url, title })`。`await import("cloudflare:workers")` を `try` で囲み、失敗したら `null` を返す。コメントは「ローカルの vite dev (Node) には無く、推定しないことが方針 A の仕様」の 1 行。`env.AI` が `run` を持つ object かを確かめ、持たなければ `null`。`env.AI.run("@cf/cloudflare/clef", { model: "clef", state: { url, title }, questions: { category: { type: "choice", instructions, criteria } } })` を呼び、`answers.category` を (a) で `parse` して (b) に渡す。`criteria` は `category.options` の各値を、短い日本語の説明に写した object にする (`Record<Category, string>` で全カテゴリを型で縛る)。`run` の失敗と `parse` の失敗は投げたままにする
- [X] T008 [US1] `frontend/src/shared/api/suggest-category.ts` にサーバー関数 `suggestCategory` を作る。形は `fetch-any-link-preview.ts` と同じで、`createServerFn({ method: "POST" })` → `.validator(z.object({ url: newChildArticle.shape.url, title: z.string().max(500) }))` → `.handler` の中で `requireAdminToken()` してから `suggestCategoryWithAi(data)` を返す (FR-008、contracts/suggest-category.md)。`frontend/src/shared/api/index.ts` から export する
- [X] T009 [US1] `frontend/src/pages/digest-editor/model/board.ts` に `settleCategory(board, id, suggested: Category | null): Board` を足す。`suggested` が `null` か、`id` の候補が `board[UNSORTED]` に無いときは `board` をそのまま返す。あるときは未分類から外し、`board[suggested]` の末尾に `{ ...draft, suggested: true }` で入れる (FR-003)
- [X] T010 [US1] `frontend/src/pages/digest-editor/ui/url-add-form.tsx` の `onAdd` の、`setAdding(false)` とフォーカスの後に、推定を呼ぶ処理を足す。`useServerFn(suggestCategory)` で `{ url: link, title: title ?? "" }` を渡し、結果を `setBoard((b) => settleCategory(b, id, c))` で反映する。失敗は `catch` して何もしない。コメントは「推定は補助で、失敗しても未分類から手で振り分けられる (FR-007)」の 1 行

**Checkpoint**: `just test` と `just fe-typecheck` が通る。`just fe-dev` で URL を追加すると、未分類に残ってエラーが出ない

---

## Phase 4: User Story 2 - 推定で入った候補だと見て分かる (Priority: P1)

**Goal**: 推定で入った候補に印が付き、手で別の箱へ移すと外れる。

**Independent Test**: 推定で入った候補に印があり、別の箱へドラッグすると消え、同じ箱で並び替えたときは残ることを確かめる。

### Tests for User Story 2

- [X] T011 [P] [US2] `frontend/src/pages/digest-editor/model/board.test.ts` にテストを書く。`it("clears the suggestion mark when the admin moves the draft to another box")` (`moveToBoxEnd` と `fromIds` の両方)、`it("keeps the suggestion mark when reordering within the same box")` (`fromIds`)

### Implementation for User Story 2

- [X] T012 [US2] `frontend/src/pages/digest-editor/model/board.ts` で、箱が変わる移動のときに `suggested` を `false` にする。`moveToBoxEnd` は `at.box !== box` のとき。`fromIds` は、`byId` を作るときに元の箱も持ち、`next` の箱と違う候補だけを `{ ...draft, suggested: false }` にする。変わらない箱の配列の参照を使い回す既存の最適化は崩さない (research R5)
- [X] T013 [US2] `frontend/src/pages/digest-editor/ui/draft-card.tsx` で、`draft.suggested` のときにタイトルの横に小さな印を出す。見た目は `--color-brand` の小さな印にし、意味は読み上げ用のラベル (例: 「AI の推定」) に入れる。画面に説明文は並べない (frontend-ui-design.md の「選べない理由」の型、FR-004)。スタイルは `frontend/src/pages/digest-editor/ui/draft-card.module.css` に、トークンだけで書く。押す対象の位置がずれないよう、印の有無で行の高さを変えない

**Checkpoint**: `just lint && just test`、`just fe-typecheck` が通る

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T014 `just fe-dev` を起動し、`/admin/digests/new` で URL を追加して、`cloudflare:workers` の import が vite の変換の段階で落ちず、未分類に残ることを確かめる (research R3 の確認事項)。落ちたら T002 を `environments.ssr.resolve.external` に変え、確かめ直す
  - 結果: vitest と vite dev の変換で解決に失敗したので、T002 の `environments.ssr` をやめ、`cloudflare:` を external にする `resolveId` プラグイン (`cloudflareBuiltins`) を vite と vitest の両方に入れた。vite dev の SSR で `null` が返ることを確かめた
- [X] T015 [P] Workers AI を使うことと、ローカルでは推定しないこと (方針 A、却下した案は `@cloudflare/vite-plugin` と REST API) を、`adr/frontend/0011-suggest-category-with-workers-ai-clef.md` に ADR として残す (adr-skill の形式、`adr/frontend/README.md` の索引も更新)
- [X] T016 [P] `docs/tech-stack.md` のデプロイの行の近くに、Workers AI binding (`AI`) を使っていることを 1 行足す
- [X] T017 完了の判定を回す: `just lint && just test`、`just fe-typecheck`、`pnpm -C frontend build`。e2e は回さない (quality.md: 保存とセッションに触れない)

---

## Dependencies & Execution Order

- Phase 1 (T001〜T003) → Phase 2 (T004) → US1 (T005〜T010) → US2 (T011〜T013) → Polish
- US2 の印は、US1 の `settleCategory` が `suggested: true` を付けて初めて見えるので、US1 の後に行う
- US1 の中: T005・T006 (テスト) → T007 → T008 → T009 → T010
- T007 と T009 は別ファイルなので並行してよい。T010 は T008 と T009 の両方の後

## Parallel Example: User Story 1

```text
T005 category-suggestion.server.test.ts  ||  T006 board.test.ts
T007 category-suggestion.server.ts       ||  T009 board.ts (settleCategory)
```

## Implementation Strategy

- **MVP**: Phase 1〜3 (US1)。印がなくても振り分けの手間は減るが、spec は US2 も P1 なので、両方を入れてからデプロイする
- 本番での確かめ (quickstart.md の「デプロイ先」) は、main に入った後に管理者が行う

## Notes

- コミットは頼まれたときだけ行う
- コードのコメントは理由だけを 1 行で書く (code-comment.md)
