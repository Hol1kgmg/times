---

description: "Task list for 登録済みの Digest を編集する (005-digest-edit)"
---

# Tasks: 登録済みの Digest を編集する

**Input**: Design documents from `/specs/005-digest-edit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, contracts/ui.md, quickstart.md

**Tests**: constitution V に従い、contracts/ui.md のテスト対応表のとおりに各 Story へテストタスクを含める。DB に接続するテストは書かない。

**Organization**: backend の 3 操作は生成された strict interface を満たさないとビルドが通らないので、handler まで Phase 2 で作る。US1 (一覧 → 編集 → 保存) が MVP。US2 (日付変更) は backend が Phase 2 で済んでいるので e2e の追加だけ。US3 (変更を戻す) は US1 と独立に進められる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列可 (別ファイルで、未完了タスクに依存しない)
- **[Story]**: US1 / US2 / US3
- 各タスクにファイルパスを書く

## Path Conventions

- backend: `backend/` (Go)。生成物は `backend/internal/api/gen.go`、`backend/internal/db/*.go`、`frontend/src/shared/api/openapi.gen.ts` (`just be-gen`)
- frontend: `frontend/src/` (FSD)。テストは同階層の `*.test.ts` と `frontend/e2e/`

---

## Phase 1: Setup

新しい依存・環境変数・設定・migration はないので、このフェーズのタスクはない。

---

## Phase 2: Foundational (契約と backend)

**Purpose**: 3 つの API 操作を契約から handler まで通す。全 Story が依存する。

**⚠️ CRITICAL**: T001〜T003 は再生成 (`just be-gen`) を伴い、生成物を同じコミットに含める (constitution II)。

- [X] T001 `backend/api/openapi.yaml` を contracts/openapi.md のとおりに変える。`/digests` に `get` (`operationId: listDigests`、summary「登録済みの Digest の日付を新しい順に返す。記事は含まない」、200 は `DigestList`) を足す。`/digests/{entryDate}` を新設し、パスレベルの `parameters` に `entryDate` (`in: path`, `required: true`, `type: string`, `format: date`) を置く。その下に `get` (`operationId: getDigestByDate`、200 `Digest` / 400 / 404 Problem) と `put` (`operationId: updateDigest`、`security: [bearerAuth: []]`、requestBody は `NewDigest`、200 `Digest`、400 の description は contracts/openapi.md の文をそのまま、401 は `#/components/responses/Unauthorized`、404「自分の Digest にその日付のものがない (not-found)」) を置く。`components/schemas` に `DigestList` (`required: [items]`、`items: array of DigestSummary`) と `DigestSummary` (`required: [id, entryDate]`、`id: string/uuid`、`entryDate: string/date`) を足す。`Problem.type` の enum は変えない
- [X] T002 [P] `backend/db/queries/digests.sql` に data-model.md の 4 本を足す: `ListDigests :many` (`SELECT id, entry_date FROM digests ORDER BY entry_date DESC, created_at DESC;`)、`GetDigestByDate :one` (`SELECT * FROM digests WHERE entry_date = $1 ORDER BY created_at DESC LIMIT 1;`。直前に `-- ponytail: 管理者 1 人の前提で created_by を見ない。複数になったら条件を足す` の 1 行)、`UpdateDigestDate :one` (`UPDATE digests SET entry_date = sqlc.arg(new_date) WHERE created_by = sqlc.arg(created_by) AND entry_date = sqlc.arg(old_date) RETURNING *;`)、`DeleteArticlesByDigest :exec` (`DELETE FROM articles WHERE digest_id = $1;`)
- [X] T003 `just be-gen` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/digests.sql.go`、`frontend/src/shared/api/openapi.gen.ts` の再生成をコミット対象にする。`api.StrictServerInterface` に `ListDigests` / `GetDigestByDate` / `UpdateDigest` が生えていることを確認する
- [X] T004 `backend/internal/handler/handler.go` の `CreateDigest` から、`ListRegisteredURLs` の判定と記事・親子の挿入 (`insert` クロージャと `for _, a := range req.Body.Items` のループ) を `func insertArticles(ctx context.Context, q *db.Queries, d db.Digest, userID int64, items []api.NewArticle) ([]db.Article, []db.ArticleLink, error)` に切り出す (`userID` の型は `p.UserID` に合わせる)。`CreateDigest` はそれを呼ぶだけにする。挙動は変えない
- [X] T005 `backend/internal/handler/handler.go` に `ListDigests` を足す: `s.q.ListDigests` の行を `api.DigestList{Items: []api.DigestSummary{...}}` に写して 200 を返す (0 件でも `items: []`、nil にしない)
- [X] T006 `backend/internal/handler/handler.go` に `GetDigestByDate` を足す: `GetLatestDigest` と同じ形で、`s.q.GetDigestByDate(ctx, req.EntryDate.Time)` が `pgx.ErrNoRows` なら `apperr.NotFound("no digest for the entry date")`、あれば記事と親子を引いて `toDigest` で 200
- [X] T007 `backend/internal/handler/handler.go` に `UpdateDigest` を足す。data-model.md「保存の手順」の順を守る: `auth.PrincipalFrom` (なければ `apperr.Unauthorized`) → `s.pool.Begin` + `defer Rollback` → `q.UpdateDigestDate(ctx, {NewDate: req.Body.EntryDate.Time, CreatedBy: p.UserID, OldDate: req.EntryDate.Time})` が `pgx.ErrNoRows` なら `apperr.NotFound("no digest for the entry date")`、その他のエラーは `constraintViolation(err)` (日付の衝突 → `digest-already-exists`) → `q.DeleteArticlesByDigest(ctx, d.ID)` → `insertArticles` (自分の記事は削除済みなので登録済み判定から外れる) → `Commit` → `api.UpdateDigest200JSONResponse(toDigest(...))`。関数の直前に理由のコメントを 1 行だけ書く (例: `// 記事を消してから URL を判定するので、この Digest 自身の URL は登録済みに数えない`)
- [X] T008 [P] `backend/cmd/server/main_test.go` の `TestRouter` の表に contracts/openapi.md の 3 行を足す: `{"GET", "/digests", "", http.StatusOK, ""}` (stub に `ListDigests` を足して空の `api.ListDigests200JSONResponse{Items: []api.DigestSummary{}}` を返す)、`{"GET", "/digests/not-a-date", "", http.StatusBadRequest, api.ProblemsvalidationFailed}`、`{"PUT", "/digests/2026-10-17", `{"entryDate":"2026-10-17","items":[]}`, http.StatusUnauthorized, api.Problemsunauthorized}`。既存の `GET /digests/latest` → 404 の行が通り続けることで、静的な経路が優先されることも確かめる (research R6)
- [X] T009 [P] `backend/api/http/digests.http` に `GET /digests`、`GET /digests/2026-10-17`、`PUT /digests/2026-10-17` (Bearer 付き、`POST /digests` の例と同じ body) の例を足す
- [X] T010 [P] `frontend/src/shared/api/schemas.ts` に `digestSummary = z.object({ id: digestId, entryDate: z.iso.date() }) satisfies z.ZodType<Schemas["DigestSummary"]>` と `digestList = z.object({ items: z.array(digestSummary) }) satisfies z.ZodType<Schemas["DigestList"]>` を足し、型 `DigestSummary` を export する。`entryDate` の書き方は既存の `digest` に合わせる

**Checkpoint**: `just lint && just test`、`just fe-typecheck` が通る。`digests.http` で 3 操作が叩ける。

---

## Phase 3: User Story 1 - 登録済みの Digest を選んで直す (Priority: P1) 🎯 MVP

**Goal**: サイドバー → 日付一覧 → 編集画面 (保存済みの配置で開く) → 保存で中身が置き換わる。

**Independent Test**: 関連記事・ホット付きの Digest を一覧から開き、配置どおり並ぶことを確かめ、タイトルを直し記事を 1 件削除して保存すると、編集画面を開き直したときに直した内容になる。

### Tests for User Story 1

- [X] T011 [P] [US1] `frontend/src/pages/digest-new/model/board.test.ts` に `it("reopens a saved digest with the same categories, order, hot flags and related articles")` を足す: 2 カテゴリにまたがり、ホットの記事と子 2 件の記事を含む `Digest` を作り、`toNewDigest(fromDigest(d), d.entryDate)` が `d` の `entryDate` と各記事の `category` / `hot` / `title` / `url` / `children` (`title` / `url` の順) と一致することを確かめる。未分類の箱が空であることも見る
- [X] T012 [P] [US1] `frontend/e2e/digest-new.spec.ts` の「未ログインでは登録ページは 404 で…」のテストに、`/admin/digests` を開くと 404 であることを 1 行足す (US1-9)

### Implementation for User Story 1

- [X] T013 [P] [US1] `frontend/src/pages/digest-new/model/board.ts` に `export const fromDigest = (digest: Digest): Board` を足す: `emptyBoard()` から始め、`digest.items` を順に `board[item.category]` の末尾へ `{ id: item.id, url, title, initial: { url, title }, status: "done", hot: item.hot, children: item.children.map((c) => ({ id: c.id, url: c.url, title: c.title, initial: { url: c.url, title: c.title }, status: "done" })) }` として入れる。`Digest` 型は `#/shared/api/schemas` から import する
- [X] T014 [P] [US1] `frontend/src/shared/ui/digest-post.tsx` の `dateFormat` を `export` する (日付一覧で同じ書式を使うため)
- [X] T015 [P] [US1] `frontend/src/pages/digest-new/api/get-digest.ts` を作る: `createServerFn({ method: "GET" }).validator(z.iso.date())` の handler で `backendFetchRaw(\`/digests/${data}\`)` を呼び、404 なら `throw notFound()`、`!res.ok` なら `create-digest.ts` と同じ形のエラー、それ以外は `digest.parse(await res.json())` を返す。`cachedJson` は通さない (research R11)。日付の形でない `$date` は validator が弾くので、ルート側で `notFound()` に写す
- [X] T016 [P] [US1] `frontend/src/pages/digest-new/api/update-digest.ts` を作る: `create-digest.ts` と同じ作りで、`.validator(z.object({ date: z.iso.date(), digest: newDigest }))`、`backendFetch(\`/digests/${data.date}\`, { method: "PUT", ... body: JSON.stringify(data.digest) }, { token })`、拒否は `rejectionOf` で返し、成功時は `throw redirect({ to: "/admin/digests" })`
- [X] T017 [US1] `frontend/src/pages/digest-new/ui/digest-new-page.tsx` を contracts/ui.md の表のとおりに props 化する: 中身を `DigestForm` (非 export) にし、`heading` / `initialDate` (`undefined` なら今の `today()` の既定値) / `initialBoard` / `submitLabel` / `leaveMessage` / `save: (entry: NewDigest) => Promise<Rejection>` / `isDirty: (entry: NewDigest, board: Board) => boolean` を受ける。`DigestNewPage` は今の値 (`記事を登録`、`emptyBoard`、`登録`、`登録してない記事があります。このページを離れますか？`、`createDigest`、`hasDrafts(board)`) で包む。`DigestEditPage` は `Route.useLoaderData()` 相当の引数 `{ digest }` を受け、`記事を編集`、`digest.entryDate`、`fromDigest(digest)`、`保存`、`保存してない変更があります。このページを離れますか？`、`(entry) => updateDigest({ data: { date: digest.entryDate, digest: entry } })`、`(entry) => JSON.stringify(entry) !== JSON.stringify(toNewDigest(fromDigest(digest), digest.entryDate))` で包む。ログイン切れの文言の「登録」は `submitLabel` で差し替える。成功時の遷移はサーバー関数の `redirect` に任せる (既存のコメントの「/ へ遷移する」を「Router が遷移する」に直す)
- [X] T018 [US1] `frontend/src/pages/digest-new/index.ts` に `DigestEditPage` と `getDigest` の export を足す
- [X] T019 [P] [US1] 日付一覧のスライス `frontend/src/pages/digest-list/` を作る: `api/list-digests.ts` (`createServerFn({ method: "GET" })` で `backendFetchRaw("/digests")` → `!res.ok` ならエラー → `digestList.parse`、キャッシュなし)、`ui/digest-list-page.tsx` (`<h1>記事を編集</h1>`、`items` を `<ul>` で並べ各行を `<Link to="/admin/digests/$date/edit" params={{ date: d.entryDate }}>{dateFormat.format(new Date(d.entryDate))}</Link>`、0 件なら `<p>まだ Digest がないです</p>`)、`ui/digest-list-page.module.css` (通常面、行の区切りは `--color-border` の 1px 線、余白は `--space-*`、リンクの文字は `--color-text` でホバーとフォーカスだけ `--color-accent` (`@media (hover: hover)` の中)。生の値を書かない)、`index.ts` (`DigestListPage`, `listDigests`)
- [X] T020 [US1] ルートを 2 つ作る: `frontend/src/app/routes/_shell/admin.digests.index.tsx` (`createFileRoute("/_shell/admin/digests/")`、`beforeLoad: resolveDigestNewPage`、`loader: () => listDigests()`、component は loader の値を `DigestListPage` に渡す) と `frontend/src/app/routes/_shell/admin.digests.$date.edit.tsx` (`beforeLoad: resolveDigestNewPage`、`loader` で `getDigest({ data: params.date })` を呼び、validator の失敗は `notFound()` に写す、component は `DigestEditPage`)。ファイル名を `admin.digests.tsx` にしない理由 (research R8) を index 側に 1 行コメントで残す。生成される `routeTree.gen.ts` を確認する
- [X] T021 [US1] `frontend/src/app/layout/sidebar.tsx` の「記事を登録」の `<Link>` の直後に `<Link className={styles.link} to="/admin/digests" onClick={onNavigate}><span className={styles.hash}>#</span>記事を編集</Link>` を足す
- [X] T022 [US1] `frontend/e2e/digest-edit.spec.ts` を作る (contracts/ui.md のテスト対応表の 1 本目)。`digest-new.spec.ts` の `loggedInState` と箱の操作のヘルパーを使い、まず関連記事付き・ホット付きの Digest を新規登録する。日付は実行ごとに変える (research R12。例: `2100-01-01` に `Date.now()` 由来の日数を足す)。URL も実行ごとに変える。続けてサイドバー「記事を編集」→ 一覧でその日付を選ぶ → 各カテゴリに記事が登録時の順で並び、ホットと関連記事があることを確認 → タイトルを 1 件直し、記事を 1 件削除して保存 → 一覧に戻ることを確認 → 同じ日付を開き直して直した内容になっていることを確認する (実施: ログインと箱の操作は `frontend/e2e/admin.ts` に切り出して `digest-new.spec.ts` と共用。日付は最新を奪わないよう 1900 年以降の過去日にした。`digest-new.spec.ts` も 1 日 1 Digest で再実行できるよう実行ごとの日付に直した)

**Checkpoint**: `just fe-typecheck`、`just test` (Vitest)、`just fe-test-e2e` が通る。quickstart の 1〜4、6、7、12、13 を手で確認できる。

---

## Phase 4: User Story 2 - Digest の日付を変える (Priority: P2)

**Goal**: 日付を未登録の日に変えて保存でき、登録済みの日には変えられない。backend は T007 で済んでいる (UNIQUE + `constraintViolation`)。

**Independent Test**: 日付を未登録の日に変えて保存すると一覧の日付が変わり、登録済みの日に変えると「その日の Digest は登録済みです」が出る。

- [X] T023 [US2] `frontend/e2e/digest-edit.spec.ts` の主経路の保存の前に、日付を未登録の別の日 (同じく実行ごとに変える) へ変える操作を足し、保存後の一覧に新しい日付があり古い日付がないこと、新しい日付の編集画面に直した内容が並ぶことを確認する (US2-1)。登録済みの日付への変更 (US2-2, US2-3) は e2e に入れず quickstart 8〜10 で確認する (品質ルール: 異常系は e2e に入れない。DB を通すので unit でも書けない)

**Checkpoint**: `just fe-test-e2e` が通る。quickstart の 8〜11 を手で確認できる。

---

## Phase 5: User Story 3 - 記事 1 件の変更を戻す (Priority: P2)

**Goal**: メニューの名前を「変更を戻す」にし、編集画面では保存済みの値に戻る。

**Independent Test**: 編集画面で保存済みの記事のタイトルと URL を直して「変更を戻す」を選ぶと、保存済みの値に戻り、ホットとカテゴリは変えたまま。

- [X] T024 [P] [US3] `frontend/src/pages/digest-new/ui/draft-card.tsx` の `label: "取得直後に戻す"` (2 か所、記事と関連記事のメニュー) を `label: "変更を戻す"` にする。`frontend/e2e/` に「取得直後に戻す」を参照している箇所があれば合わせて直す
- [X] T025 [P] [US3] `frontend/src/pages/digest-new/model/board.test.ts` に `it("reverts a saved article to its saved title and URL, keeping its hot flag")` を足す: `fromDigest` した board で、ある記事を `editLink` で直し `toggleHot` してから `revert` すると、`url` / `title` は保存済みの値に戻り、`hot` は切り替えたままであることを確かめる (US3-3, US3-4)。T013 の後に行う

**Checkpoint**: `just test` が通る。quickstart の 5 を手で確認できる。

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 quality ルールの完了判定を通す: `just be-gen` (差分なし)、`just lint && just test`、`just fe-typecheck`、`just fe-test-e2e`。落ちたら出力を添えて報告する (実施 2026-10-28: be-gen / lint / test / fe-typecheck は通過。fe-test-e2e は 11 件通過・`admin-login.spec.ts` の US2 3 件が失敗。ログイン直後の / で Chromium の load が来ない既存の問題で、frontend/src を HEAD に戻しても再現する。範囲外として後で対応する)
- [X] T027 quickstart.md の手動確認 1〜13 を通し、結果を報告する (実施 2026-10-28: 1・3・4・11 は e2e、5 は Vitest と画面操作、6〜10 と FR-011 は API を直接叩いて確認、12 は変更なしで確認が出ず変更ありで出ることを確認。2 の並び順は SQL の ORDER BY のみで目視していない。13 のログイン切れは新規登録と同じ処理で未確認)
- [X] T028 [P] `TODO.md` (コミットしないメモ) の「機能 (specs/)」に `specs/005-digest-edit` の行を足し、完了日と要点を書いて `[x]` にする。spec 002 の「過去 Digest の一覧」の行に、`GET /digests` を流用できることを書き添える

---

## Dependencies & Execution Order

- **Phase 2** (T001〜T010): T001 → T003 → T004 → T005〜T007。T002 は T001 と並列で、T003 の前に終える。T008〜T010 は T003 の後に並列。
- **US1** (T011〜T022): Phase 2 の後。T013 → T011。T015・T016 → T017 → T018 → T020。T019 → T020。T020・T021 → T022。
- **US2** (T023): T022 の後 (同じファイル)。
- **US3** (T024, T025): T024 は Phase 2 を待たずに着手できる。T025 は T013 の後。
- **Polish**: すべての Story の後。

## Parallel Example: User Story 1

```text
# Phase 2 の後、別ファイルなので同時に進められる
T013 board.ts の fromDigest
T014 digest-post.tsx の dateFormat export
T015 api/get-digest.ts
T016 api/update-digest.ts
T019 pages/digest-list/
T012 digest-new.spec.ts の 1 行
```

## Implementation Strategy

1. Phase 2 で backend を通し、`digests.http` で 3 操作を確かめる。
2. US1 で一覧 → 編集 → 保存までを通す。ここで止めても「登録後に直せない」問題は解消する (MVP)。
3. US2 は e2e に 1 段足すだけ。US3 はラベルとテスト 1 件で、US1 と並行してよい。
4. Polish で完了判定と手動確認を通す。コミットは頼まれたときだけ行う。
