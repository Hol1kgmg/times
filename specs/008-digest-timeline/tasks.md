---

description: "Task list for Digest のタイムライン (008-digest-timeline)"
---

# Tasks: Digest のタイムライン

**Input**: Design documents from `/specs/008-digest-timeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, quickstart.md

**Tests**: constitution V と quality.md に従い、router テスト 1 行だけを足す (research.md R6)。DB に接続するテスト・e2e・Vitest は書かない。SQL の振る舞いは quickstart の手動確認で見る。

**Organization**: 4 つの Story は同じ 1 操作 (`GET /digests/published`) の別の面で、契約・クエリ・handler を分けて作れない。Phase 2 で操作をまとめて作り、各 Story のフェーズはその Story を押さえるテストと確認だけにする。US1 + US3 の時点で MVP (直近の Digest がログインユーザーに返る)。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列可 (別ファイルで、未完了タスクに依存しない)
- **[Story]**: US1 / US2 / US3 / US4
- 各タスクにファイルパスを書く

## Path Conventions

- backend: `backend/` (Go)。生成物は `backend/internal/api/gen.go`、`backend/internal/db/*.go`、`frontend/src/shared/api/openapi.gen.ts` (`just be-gen`)
- frontend: `frontend/src/shared/api/`

---

## Phase 1: Setup

新しい依存・環境変数・migration はないので、このフェーズのタスクはない。

---

## Phase 2: Foundational (契約・クエリ・handler・frontend の型)

**Purpose**: `GET /digests/published` を OpenAPI から `schemas.ts` まで通す。全 Story が依存する。

**⚠️ CRITICAL**: T001 と T002 の後に T003 の再生成が要り、生成物を同じコミットに含める (constitution II)。

- [X] T001 [P] `backend/api/openapi.yaml` の `paths` の `/digests/latest` の後 (`/digests/{entryDate}` のコメントの前) に `/digests/published` を足す。`operationId: listPublishedDigests`、`security: [bearerAuth]`、query `before` は `type: string` / `format: date`、query `limit` は `type: integer` / `minimum: 1` / `maximum: 31` / `default: 7`、応答は 200 `DigestPage` / 400 `#/components/responses/BadRequest` / 401 `#/components/responses/Unauthorized`。`description` は `specs/008-digest-timeline/contracts/openapi.md` の文をそのまま使う (並び・limit の単位・before を含まないこと・管理者の Digest だけ)。`components/schemas` の `DigestList` の前に `DigestPage` (`required: [digests]`、`digests` は `Digest` の配列) を足す
- [X] T002 [P] `backend/db/queries/digests.sql` の `GetLatestDigest` の後に `specs/008-digest-timeline/data-model.md` の `ListPublishedDigests :many` をそのまま書く (`SELECT * FROM digests`、`status = 'published'`、`created_by IN (SELECT id FROM users WHERE lower(login) = lower(sqlc.arg(admin_login)))`、`sqlc.narg(before)::date IS NULL OR entry_date < sqlc.narg(before)`、`ORDER BY entry_date DESC LIMIT sqlc.arg(lim)`)。上限を `-- ponytail: 管理者はユーザー名で判定する。同じ login の行が 2 つあれば混ざる (spec Assumptions)` の 1 行で残す
- [X] T003 `just be-gen` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/digests.sql.go`、`frontend/src/shared/api/openapi.gen.ts` を再生成する (T001, T002 の後)。`ListPublishedDigestsParams.Before` が `pgtype.Date` になったら、`backend/sqlc.yaml` の `overrides` に `db_type: date` / `nullable: true` / `go_type: { type: time.Time, pointer: true }` を足して `*time.Time` にし、もう一度 `just be-gen` する (既存の nullable text と同じく oapi-codegen の optional と揃えるため。nullable な date 列はないので他の生成物は変わらない)。返り値が `[]db.Digest` であることを確かめる
- [X] T004 `backend/internal/handler/handler.go` の `GetLatestDigest` の後に `ListPublishedDigests` を実装する。`req.Params.Limit` が nil なら 7 (OpenAPI の `default` は oapi-codegen が埋めないため。`articleDomains` と同じ理由のコメント 1 行)、`req.Params.Before` が nil でなければ `&req.Params.Before.Time` を渡し、`AdminLogin: s.adminLogin` で `s.q.ListPublishedDigests` を呼ぶ。各行に `s.withArticles(ctx, d)` を呼んで `[]api.Digest` に詰め、`api.ListPublishedDigests200JSONResponse{Digests: ...}` を返す。0 件でも `digests` は `[]` (`make(..., 0, len(rows))`)。Digest ごとにクエリを投げる上限を `// ponytail: Digest ごとに記事を引く (最大 1 + 31×2 クエリ)。遅くなったら ANY でまとめて引いて振り分ける` の 1 行で残す (research.md R4) (T003 の後)
- [X] T005 [P] `frontend/src/shared/api/schemas.ts` の `digestList` の前に `digestPage = z.object({ digests: digest.array() }) satisfies z.ZodType<Schemas["DigestPage"]>` を足す (T003 の後)
- [X] T006 `frontend/src/shared/api/list-published-digests.ts` を新規作成する。`list-article-domains.ts` と同じ形で `createServerFn({ method: "GET" }).validator(z.object({ before: z.iso.date().optional(), limit: z.number().int().min(1).max(31).optional() }))`、handler で `URLSearchParams` に値のある項目だけ入れて `backendFetch(\`/digests/published?${params}\`, undefined, { token: requireAdminToken() })`、返り値は `digestPage.parse(await res.json())`。公開の切り替えをすぐ反映させるためキャッシュを通さない理由と、`// ponytail: 一般ユーザーのセッションができたら、管理者に限らないトークンに替える` を 1 行ずつ残す。`frontend/src/shared/api/index.ts` に `export { listPublishedDigests } from "./list-published-digests";` を `listDigests` の後に足す (T005 の後)

**Checkpoint**: `just lint && just test` と `just fe-typecheck` が通る。

---

## Phase 3: User Story 1 - 直近の Digest を記事ごとまとめて受け取る (Priority: P1) 🎯 MVP

**Goal**: 指定なしで、公開の Digest が日付の新しい順に、記事つきで最大 7 件返る。

**Independent Test**: quickstart.md の 1 (並び・既定件数・公開だけ)、2 (件数の指定)、5 (トップと同じ形)、10 (非公開は出ない)。

- [X] T007 [US1] quickstart.md「2. 手動確認」の 1・2・5・6・10 を開発用 DB (`times`) で実行し、期待どおりか確かめる (自動テストなし、research.md R6)

**Checkpoint**: 直近の Digest がトップと同じ形で返る。

---

## Phase 4: User Story 2 - さかのぼって古い Digest を読み足す (Priority: P1)

**Goal**: `before` を渡すと、その日付を含まずそれより前の Digest が返り、繰り返すと重複も抜けもなく最初までたどれる。

**Independent Test**: quickstart.md の 3 (`before` は含まない)、4 (最後までたどると件数が一致)、7 (それより前がなければ空)。

- [X] T008 [US2] quickstart.md「2. 手動確認」の 3・4・7 を実行し、期待どおりか確かめる

**Checkpoint**: タイムラインを最初の Digest までたどれる。

---

## Phase 5: User Story 3 - ログインしていない人には返さない (Priority: P1)

**Goal**: 未ログインは 401、形の違う入力は 400。

**Independent Test**: router テストと quickstart.md の 8・9。

- [X] T009 [US3] `backend/cmd/server/main_test.go` の `TestRouter` の表の `/articles/domains/all` の行の後に `{"GET", "/digests/published", "", http.StatusUnauthorized, api.Problemsunauthorized},` を足す (FR-009)
- [X] T010 [US3] quickstart.md「2. 手動確認」の 8・9 を実行し、期待どおりか確かめる

**Checkpoint**: `just test` が通り、未ログインと形の違う入力が拒否される。

---

## Phase 6: User Story 4 - 管理者が作った Digest だけを返す (Priority: P1)

**Goal**: 管理者ではない作成者の Digest は返らず、管理者のユーザー名の大文字小文字は区別しない。

**Independent Test**: quickstart.md の 11 (他の作成者の Digest が出ない)、12 (大文字小文字)。

- [X] T011 [US4] quickstart.md「2. 手動確認」の 11・12 を実行し、期待どおりか確かめる。11 の後片付け (追加した `users` と `digests` の行の削除) まで行う

**Checkpoint**: 返る Digest が管理者のものだけになっている。

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T012 quality.md「完了の判定」を通す: `just be-gen` (差分なし)、`just lint && just test`、`just fe-typecheck`。e2e は回さない (使う画面がなく、research.md R6)
- [X] T013 [P] `TODO.md` の「過去 Digest のタイムライン画面」に、API (`GET /digests/published`) とサーバー関数 `listPublishedDigests` が specs/008 でできたことと、画面を作るときに e2e を 1 本書くことを書き足す (TODO.md はコミットしない)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2**: T001 / T002 (並列) → T003 → T004 と T005 (並列) → T006 (T005 の後)
- **Phase 3〜6**: Phase 2 の完了後。T009 は T003 の後ならいつでも書ける。手動確認 (T007・T008・T010・T011) は `just be-dev` を再起動してから、どの順でもよい
- **Phase 7**: すべての後

### User Story Dependencies

- 4 つとも Phase 2 の同じ操作に依存し、Story どうしの依存はない

### Parallel Opportunities

- T001 と T002 (openapi.yaml と digests.sql)
- T004 と T005 (handler.go と schemas.ts)
- T013 は他のどのタスクとも並列

## Parallel Example: Phase 2

```text
Task: "T001 openapi.yaml に /digests/published と DigestPage を足す"
Task: "T002 digests.sql に ListPublishedDigests を足す"
# → T003 just be-gen
Task: "T004 handler.go に ListPublishedDigests"
Task: "T005 schemas.ts に digestPage"
```

## Implementation Strategy

### MVP First (US1 + US3)

1. Phase 2 を通す
2. T007 (US1) と T009・T010 (US3) で、直近の Digest がログインユーザーにだけ返ることを確かめる
3. ここで止めても、タイムラインの最初の表示に使える

### Incremental Delivery

1. MVP の後に T008 (US2: 読み足し) と T011 (US4: 管理者への絞り込み) を確かめる。実装は Phase 2 で済んでいるので、確認だけ
2. T012 で完了の判定を通す
