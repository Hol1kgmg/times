---

description: "Task list for Digest の公開ステータス (006-digest-status)"
---

# Tasks: Digest の公開ステータス

**Input**: Design documents from `/specs/006-digest-status/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, contracts/ui.md, quickstart.md

**Tests**: constitution V に従い、contracts/ui.md のテスト対応表のとおりに各 Story へテストタスクを含める。DB に接続するテストは書かない。

**Organization**: 列・契約・handler・`schemas.ts` は生成型と `satisfies` で結ばれていて、片方だけ変えるとビルドか typecheck が落ちるので Phase 2 でまとめて通す。US1 (下書きで作ってトップに出さない) が MVP。US2 (下書きを公開) と US3 (取り下げ・戻す) はどちらも編集フォームの選択肢なので、US2 で作り、US3 は確認だけにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列可 (別ファイルで、未完了タスクに依存しない)
- **[Story]**: US1 / US2 / US3
- 各タスクにファイルパスを書く

## Path Conventions

- backend: `backend/` (Go)。生成物は `backend/internal/api/gen.go`、`backend/internal/db/*.go`、`frontend/src/shared/api/openapi.gen.ts` (`just be-gen`)、`docs/schema/` (`just db-doc`)
- frontend: `frontend/src/` (FSD)。テストは同階層の `*.test.ts` と `frontend/e2e/`

---

## Phase 1: Setup

新しい依存・環境変数・設定はないので、このフェーズのタスクはない。

---

## Phase 2: Foundational (列・契約・backend・frontend の型)

**Purpose**: `status` を DB から `schemas.ts` まで通し、未ログインに見せる範囲を `getLatestDigest` の公開 1 件に絞る。全 Story が依存する。

**⚠️ CRITICAL**: T002〜T004 は再生成 (`just be-gen`、`just db-doc`) を伴い、生成物を同じコミットに含める (constitution II)。

- [X] T001 `just db-migrate-new digest_status` で `backend/db/migrations/000010_digest_status.{up,down}.sql` を作る。up: `ALTER TABLE digests ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'private'));` の後に `ALTER TABLE digests ALTER COLUMN status DROP DEFAULT;`。理由のコメントは 1 行 (「既存の Digest は公開のまま。既定値は openapi.yaml だけに置く」の趣旨)。down: `ALTER TABLE digests DROP COLUMN status;`。`just db-up` で当てる (research R1, FR-010)
- [X] T002 `backend/api/openapi.yaml` を contracts/openapi.md のとおりに変える: `DigestStatus` (`enum: [draft, published, private]`) を足し、`Digest` と `DigestSummary` の `required` と `properties` に `status` ($ref) を足す。`NewDigest` に `status: {type: string, enum: [draft, published], default: draft}` を足す。`DigestUpdate` (`required: [entryDate, articles]`、`entryDate` / `articles` は `NewDigest` と同じ定義、`status: {type: string, enum: [published, private]}` で省略可、説明に「省略すると今のまま。draft へは戻せない」) を足し、`updateDigest` の requestBody を `DigestUpdate` にする。`listDigests` と `getDigestByDate` に `security: [bearerAuth: []]` と `"401": $ref: "#/components/responses/Unauthorized"` を足す。`getLatestDigest` の description と 404 の説明を「公開の Digest」に直す
- [X] T003 `backend/db/queries/digests.sql` を data-model.md のとおりに変える: `GetLatestDigest` に `WHERE status = 'published'`、`ListDigests` の SELECT に `status`、`CreateDigest` を `INSERT INTO digests (entry_date, created_by, status) VALUES ($1, $2, $3)`、`UpdateDigestDate` を `UpdateDigest` に改名して `SET entry_date = sqlc.arg(new_date), status = COALESCE(sqlc.narg(status), status)` にする (research R3)
- [X] T004 `just be-gen` と `just db-doc` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/{digests.sql.go,models.go}`、`frontend/src/shared/api/openapi.gen.ts`、`docs/schema/` を再生成する
- [X] T005 `backend/internal/handler/handler.go` を生成型に合わせる: `CreateDigest` は `req.Body.Status` が nil なら `draft` として `CreateDigestParams.Status` に渡す (`hot` の `a.Hot != nil && *a.Hot` と同じ形)。`UpdateDigest` は `q.UpdateDigest` を呼び、`req.Body.Status` を sqlc の narg 型 (`pgtype.Text` なら `{String: string(*s), Valid: true}`、nil なら無効) に写す。`toDigest` と `ListDigests` で `Status: api.DigestStatus(d.Status)` を詰める
- [X] T006 `backend/cmd/server/main_test.go` を contracts/openapi.md の「router テスト」のとおりに直す: `TestRouter` の `GET /digests` を 401 / `unauthorized` に、`GET /digests/2026-10-17` と `GET /digests/not-a-date` を 401 / `unauthorized` に、表の後の `detail: gone` の確認を `GET /digests/latest` に移す。`TestUnexpectedError` の経路を `GET /digests/latest` に替える。`TestBearerAuth` に `PUT /digests/2026-10-17`、有効な Bearer、`"status":"draft"` を含む妥当な body → 400 の行を足す (SC-004)。stub が新しい生成 interface を満たすよう直す。`just test` で通す
- [X] T007 [P] `frontend/src/shared/api/schemas.ts` を data-model.md の「frontend の型」のとおりに変える: `digestStatus = z.enum(["draft", "published", "private"]) satisfies z.ZodType<Schemas["DigestStatus"]>` を足し、`digest` と `digestSummary` に `status: digestStatus`。`newDigest` に `status: z.enum(["draft", "published"]).default("draft")`。`digestUpdate = newDigest.omit({ status: true }).extend({ status: z.enum(["published", "private"]).optional() }) satisfies z.ZodType<Schemas["DigestUpdate"]>` を足し、`DigestStatus` / `DigestUpdate` 型を export する
- [X] T008 [P] `frontend/src/shared/api/schemas.test.ts` に 1 件足す: `it("rejects returning a digest to draft on update")` で `digestUpdate.safeParse({ ...妥当な値, status: "draft" }).success` が false (US3-4)
- [X] T009 [P] `frontend/src/shared/api/list-digests.ts` と `frontend/src/pages/digest-new/api/get-digest.ts` を、`readAdminToken()` のトークンを渡す `backendFetch` に替える。トークンがなければ `notFound({ data: { reason: SESSION_EXPIRED } })` (update-digest.ts と同じ形)。`get-digest.ts` の 404 → `notFound()` は残す (`backendFetch` が投げる前に `backendFetchRaw` で 404 を見るか、cause の Problem で判別する) (research R4)

> 実装メモ: T006 の draft の拒否は `TestBearerAuth` の表 (body を持たない) ではなく、`TestCreateDigestRejectsNonHTTPURL` と同じ形の `TestUpdateDigestRejectsDraft` に分けた。`cmd/seed/main.go` も `CreateDigestParams.Status` (`published`) が要った。`toNewDigest` と表示側 (`DigestPost` / `digestMarkdown`) はステータスを見ないので、`schemas.ts` に `DigestContent` (`Omit<NewDigest, "status">`) を足して使う。

**Checkpoint**: `just lint && just test && just fe-typecheck` が通る。Bearer なしの `GET /digests` が 401、トップは公開の Digest だけを出す。

---

## Phase 3: User Story 1 - 下書きで作って、トップに出さない (Priority: P1) 🎯 MVP

**Goal**: 登録画面で下書き / 公開を選べ、下書きはトップに出ず、日付一覧で分かる。

**Independent Test**: 公開の Digest がある状態で、ステータスを変えずに未来の日付で登録し、トップが変わらないこと、日付一覧に「下書き」が出ることを確かめる。

- [X] T010 [US1] `frontend/src/pages/digest-new/ui/digest-new-page.tsx` の `DigestForm` に `statusOptions: readonly { value: DigestStatus; label: string }[]` と `initialStatus: DigestStatus` の props を足し、日付欄の横に `<label>ステータス</label>` + `<select>` (選択肢は `statusOptions` から作る) を置く。選んだ値は state に持ち、`save` に渡す entry と `isDirty` の比較に含める。`DigestNewPage` は `[{ value: "draft", label: "下書き" }, { value: "published", label: "公開" }]`、初期 `draft` を渡す (contracts/ui.md の表)
- [X] T011 [P] [US1] `frontend/src/pages/digest-new/ui/digest-new-page.module.css` に `<select>` の見た目を足す。入力欄の型 (境界線 + `--radius-control`、フォーカス中は外枠を `--color-accent`)。生の値は書かずトークンだけを使う
- [X] T012 [P] [US1] `frontend/src/pages/digest-new/api/create-digest.ts` の成功時の redirect を、`data.status === "published"` なら `/`、それ以外は `/admin/digests` にする (research R5)
- [X] T013 [P] [US1] `frontend/src/pages/digest-list/ui/digest-list-page.tsx` の日付リンクの中、日付の後ろに `draft` なら「下書き」、`private` なら「非公開」を出す。`published` は何も出さない。`frontend/src/pages/digest-list/ui/digest-list-page.module.css` で `composes: t-meta from global;` と `color: var(--color-text-faint);` (research R6)
- [X] T014 [US1] `frontend/e2e/digest-new.spec.ts` の登録の主経路で、「登録」を押す前にステータスで「公開」を選ぶ (`page.getByLabel("ステータス").selectOption("published")`)。以降のトップの確認は今のまま (US1-3)

**Checkpoint**: 登録画面で下書き / 公開を選べ、下書きで登録するとトップは変わらず、日付一覧に「下書き」が出る。

---

## Phase 4: User Story 2 - 下書きを公開する (Priority: P1)

**Goal**: 編集画面で、記事の修正と同じ 1 回の保存でステータスを変えられる。下書きのまま直すこともできる。

**Independent Test**: 下書きの Digest のタイトルを 1 件直して「公開」で保存し、トップに直した内容で出ることを確かめる。

- [X] T015 [US2] `frontend/src/pages/digest-new/api/update-digest.ts` の validator を `z.object({ date: z.iso.date(), digest: digestUpdate })` にする (`digestUpdate` は `#/shared/api/schemas` から取る)
- [X] T016 [US2] `frontend/src/pages/digest-new/ui/digest-new-page.tsx` の `DigestEditPage` で、`digest.status === "draft"` なら `[{ value: "draft", label: "下書きのまま" }, { value: "published", label: "公開" }]`、それ以外は `[{ value: "published", label: "公開" }, { value: "private", label: "非公開" }]` を渡し、初期値は `digest.status`。`save` では `status` が `draft` なら外して `updateDigest` に渡す。`saved` (離脱確認の比較元) にも `digest.status` を含める (contracts/ui.md の表、FR-008)
- [X] T017 [US2] `frontend/e2e/digest-edit.spec.ts` の主経路に足す: ステータスを変えずに登録 → 日付一覧の該当日付に「下書き」→ トップにその Digest の記事がない → 編集画面でステータスの選択肢が「下書きのまま / 公開」→ 記事を直し「公開」を選んで保存 → 一覧の「下書き」が消える → トップに直した内容が出る (US1-1, US1-2, US1-4, US2-1, US2-2)

> 実装メモ: `digest-edit` は過去の日付 (1900 年代) を使い、トップの最新を `digest-new` から奪わない作りなので、トップの確認はこの spec では行わない。公開後のトップの切り替えは e2e 用 DB で API を直接叩いて確認した (非公開で 1 つ前の公開へ、公開で戻る)。

> 実装メモ (2026-11-01): T010 / T011 / T014 / T016 / T017 の `<select>` は、research R7 の分割ボタン (▼ で方法を選んでから主ボタンを押す) に置き換えた。`statusOptions` / `initialStatus` は `saveActions` (先頭が既定) になり、e2e は `selectOption` ではなく「▼ → 方法 → 主ボタン」で操作する。

**Checkpoint**: 下書きを記事ごと 1 回の保存で公開できる。

---

## Phase 5: User Story 3 - 公開した Digest を取り下げる・戻す (Priority: P2)

**Goal**: 公開と非公開を行き来でき、下書きには戻せない。

**Independent Test**: 公開の Digest を 2 件用意し、新しい方を非公開にしてトップが古い方になること、公開に戻すと新しい方に戻ることを確かめる。

選択肢 (T016)・backend (T005)・draft の拒否 (T006 / T008) は前のフェーズで済んでいるので、確認だけを行う。

- [X] T018 [US3] quickstart.md の手動確認 5〜8 (選択肢に「下書き」がない、非公開でトップが戻る、公開に戻せる、更新で draft を送ると 400) を通し、結果を記録する

**Checkpoint**: 全 Story が独立に動く。

---

## Phase 6: Polish & Cross-Cutting

- [X] T019 [P] `backend/api/http/digests.http` の `GET /digests` と `GET /digests/{entryDate}` に Bearer を付け、`PUT` に `"status":"draft"` を送る例 (400 になる) を 1 つ足す
- [X] T020 [P] `specs/005-digest-edit/research.md` の R5 の末尾に「specs/006 R4 で管理者専用に置き換え」と 1 行足す
- [X] T021 quickstart.md の自動チェックをすべて通す (`just be-gen` / `just db-doc` の差分なし、`just lint && just test`、`just fe-typecheck`、`just fe-test-e2e digest-new`、`just fe-test-e2e digest-edit`)。e2e は `.agents/rules/quality.md` の手順で backend を e2e 用に切り替えて回す。続けて手動確認 1〜4、9、10 を通す

---

## Dependencies & Execution Order

- **Phase 2**: T001 → T002 / T003 → T004 → T005 → T006。T007〜T009 は T004 (生成型) の後、T005 / T006 と並列に進められる
- **US1 (Phase 3)**: Phase 2 の後。T010 → T014。T011〜T013 は T010 と並列
- **US2 (Phase 4)**: T010 (`statusOptions` の props) の後。T015 → T016 → T017
- **US3 (Phase 5)**: T016 の後
- **Polish**: 全 Story の後。T019 / T020 はいつでも

## Parallel Example: User Story 1

```text
T010 digest-new-page.tsx の <select>
T011 digest-new-page.module.css   [P]
T012 create-digest.ts の redirect  [P]
T013 digest-list-page の印          [P]
```

## Implementation Strategy

1. **MVP**: Phase 2 + US1。この時点で「未来の日付の Digest が無条件に公開される」問題は解消する (下書きで作れば出ない)。ただし下書きを公開する手段がないので、US2 と同じ PR に入れる
2. **US2**: 下書き → 公開を足して「先に作って後で出す」が完結する
3. **US3**: US2 の選択肢で動くので確認だけ
4. 各 Checkpoint で `just lint && just test && just fe-typecheck` を通す。コミットはユーザーの指示があるときだけ
