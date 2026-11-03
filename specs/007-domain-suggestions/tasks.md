---

description: "Task list for ドメイン候補 (007-domain-suggestions)"
---

# Tasks: ドメイン候補

**Input**: Design documents from `/specs/007-domain-suggestions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, quickstart.md

**Tests**: constitution V と quality.md に従い、router テスト 3 行だけを足す (research.md R5)。DB に接続するテスト・e2e・Vitest は書かない。SQL の振る舞いは quickstart の手動確認で見る。

**Organization**: 3 つの Story は同じ 1 操作 (`GET /articles/domains`) の別の面で、契約・クエリ・handler を分けて作れない。Phase 2 で操作をまとめて作り、各 Story のフェーズはその Story を押さえるテストと確認だけにする。US1 + US3 の時点で MVP (一覧が管理者に返る)。

**追加 (2026-11-03)**: US4 (公開分) は T001〜T013 の完了後に足した。全件の経路を `/articles/domains/all` に移し、`/articles/domains` を公開分にするので、Phase 7 は完了済みの T001・T002・T004・T006・T010 の中身を書き換える。

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

**Purpose**: `GET /articles/domains` を OpenAPI から `schemas.ts` まで通す。全 Story が依存する。

**⚠️ CRITICAL**: T001 と T002 の後に T003 の再生成が要り、生成物を同じコミットに含める (constitution II)。

- [X] T001 [P] `backend/api/openapi.yaml` の `paths` に `/articles/domains` (`operationId: listArticleDomains`、`security: [bearerAuth]`、query `q` は `type: string` / `maxLength: 100`、query `limit` は `type: integer` / `minimum: 1` / `maximum: 50` / `default: 20`、応答は 200 `DomainList` / 400 Problem (`validation-failed`) / 401 `#/components/responses/Unauthorized`) を `/digests/{entryDate}` の後、`/auth/sessions` の前に足す。`components/schemas` に `DomainList` (`required: [domains]`、`domains` は `DomainCount` の配列) と `DomainCount` (`required: [host, count]`、`host` は `type: string` / `minLength: 1`、`count` は `type: integer` / `minimum: 1`) を `DigestSummary` の後に足す。中身は `specs/007-domain-suggestions/contracts/openapi.md` のとおり
- [X] T002 [P] `backend/db/queries/articles.sql` を新規作成し、`specs/007-domain-suggestions/data-model.md` の `ListArticleDomains :many` をそのまま書く (`substring(url from '^https?://([^/:?#]+)')`、`sqlc.narg(q)::text IS NULL OR strpos(lower(host), lower(sqlc.narg(q))) > 0`、`ORDER BY count DESC, host LIMIT sqlc.arg(lim)`、`count(*)::int`)。`created_by` を見ない理由として `-- ponytail: 管理者 1 人の前提で created_by を見ない。複数になったら条件を足す` を付ける (digests.sql の `GetDigestByDate` と同じ文言)
- [X] T003 `just be-gen` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/articles.sql.go`、`frontend/src/shared/api/openapi.gen.ts` を再生成する (T001, T002 の後)
- [X] T004 `backend/internal/handler/handler.go` の `ListDigests` の後に `ListArticleDomains` を実装する。`req.Params.Limit` が nil なら 20 (OpenAPI の `default` は oapi-codegen が埋めないため。理由を 1 行コメントに残す)、`req.Params.Q` をそのまま `q` に渡して `s.q.ListArticleDomains` を呼び、行を `api.DomainCount{Host, Count}` に詰め替えて `api.ListArticleDomains200JSONResponse{Domains: ...}` を返す。結果が 0 件でも `domains` は `[]` (nil にしない、`make(..., 0, len(rows))`) (T003 の後)
- [X] T005 [P] `frontend/src/shared/api/schemas.ts` の `digestList` の後に `domainCount = z.object({ host: z.string().min(1), count: z.number().int().min(1) }) satisfies z.ZodType<Schemas["DomainCount"]>` と `domainList = z.object({ domains: domainCount.array() }) satisfies z.ZodType<Schemas["DomainList"]>` を足す (T003 の後)
- [X] T006 `frontend/src/shared/api/list-article-domains.ts` を新規作成する。`list-digests.ts` と同じ形で `createServerFn({ method: "GET" }).validator(z.object({ q: z.string().max(100).optional(), limit: z.number().int().min(1).max(50).optional() }))`、handler で `URLSearchParams` に値のある項目だけ入れて `backendFetch(\`/articles/domains?${params}\`, undefined, { token: requireAdminToken() })`、返り値は `domainList.parse(await res.json())`。記事の登録直後に反映させるためキャッシュを通さない理由を 1 行コメントに残す。`frontend/src/shared/api/index.ts` に `export { listArticleDomains } from "./list-article-domains";` を足す (T005 の後)

**Checkpoint**: `just lint && just test` と `just fe-typecheck` が通る。

---

## Phase 3: User Story 1 - 登録済みのドメインを件数順に一覧する (Priority: P1) 🎯 MVP

**Goal**: 入力なしで、ドメインと件数が件数の多い順に返る。

**Independent Test**: quickstart.md の 1 (順序・同数はドメイン名順)、8 (下書きの記事も数える)、9 (件数の合計が記事数と一致)。

- [X] T007 [US1] quickstart.md「2. 手動確認」の 1・8・9 を開発用 DB (`times`) で実行し、期待どおりか確かめる (自動テストなし、research.md R5)

**Checkpoint**: US1 の受け入れシナリオ 1〜4 を満たす。

---

## Phase 4: User Story 2 - 入力した文字でドメインを絞り込む (Priority: P1)

**Goal**: `q` で大文字小文字を区別せず部分一致に絞り、`limit` で件数を切る。範囲外の `limit` は 400。

**Independent Test**: router テストの 400 と、quickstart.md の 2〜6。

- [X] T008 [US2] `backend/cmd/server/main_test.go` の `TestBearerAuth` の表で、`{"POST", "/digests", "Bearer valid", 400, true}` の後に `{"GET", "/articles/domains?limit=51", "Bearer valid", 400, true}, // 認証後に query 検証 (specs/007 FR-004)` を足す
- [X] T009 [US2] quickstart.md「2. 手動確認」の 2〜6 を実行し、`%` で全件にならないこと、範囲外の `limit` が 400 になることを確かめる

**Checkpoint**: US2 の受け入れシナリオ 1〜5 と Edge Cases (`%` / `_`、空文字、100 文字超) を満たす。

---

## Phase 5: User Story 3 - 管理者以外には見せない (Priority: P1)

**Goal**: 未ログインは 401。

**Independent Test**: router テストの 401 と、quickstart.md の 7。

- [X] T010 [P] [US3] `backend/cmd/server/main_test.go` の `TestRouter` の表で、`{"GET", "/digests", "", http.StatusUnauthorized, api.Problemsunauthorized},` の後に `{"GET", "/articles/domains", "", http.StatusUnauthorized, api.Problemsunauthorized},` を足す (コメント「未ログインに見せるのは latest だけ (specs/006 FR-003)」の対象に含まれるので、コメントは足さない)
- [X] T011 [US3] quickstart.md「2. 手動確認」の 7 を実行し、401 を確かめる

**Checkpoint**: US3 の受け入れシナリオ 1〜2 を満たす。

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 quality.md「完了の判定」を通す: `just be-gen` で差分なし、`just lint && just test`、`just fe-typecheck`。e2e は回さない (research.md R5)
- [X] T013 `TODO.md` の「機能 (specs/)」に `specs/007-domain-suggestions` の行を足し、完了したら日付と要点を添えて `[x]` を付ける。使う画面 (ComboBox) を作るときに e2e を 1 本書くことを残す

---

## Phase 7: User Story 4 - 公開の記事のドメインだけを、ログインユーザーが絞り込む (Priority: P2)

**Goal**: `GET /articles/domains` は公開の Digest の記事だけを数え、全件は `GET /articles/domains/all` に移す。どちらも `bearerAuth` (research.md R8, R10)。

**Independent Test**: router テストの 401 (2 経路) と、quickstart.md の 1〜14 (全件は `/all` で流し直す)。

- [X] T014 [US4] `backend/api/openapi.yaml`: `components` に `parameters` を足し、`DomainQuery` (`name: q`、`in: query`、`type: string` / `maxLength: 100`) と `DomainLimit` (`name: limit`、`in: query`、`type: integer` / `minimum: 1` / `maximum: 50` / `default: 20`) を置く。既存の `/articles/domains` の `parameters` をこの 2 つの `$ref` に替え、`description` を「公開の Digest の記事の URL のドメインを、記事の件数の多い順に返す。ログインユーザーなら誰でも使える (今ログインできるのは管理者だけ)」にする。その後に `/articles/domains/all` (`operationId: listAllArticleDomains`、`description`「登録済みの記事の URL のドメインを、Digest のステータスを問わず記事の件数の多い順に返す。管理者専用」、`security: [bearerAuth]`、同じ 2 つの `$ref`、応答は `/articles/domains` と同じ 200 / 400 / 401) を足す。中身は `specs/007-domain-suggestions/contracts/openapi.md` のとおり
- [X] T015 [P] [US4] `backend/db/queries/articles.sql` の `ListArticleDomains` を `specs/007-domain-suggestions/data-model.md` のクエリに替える (`articles a JOIN digests d ON d.id = a.digest_id`、`WHERE NOT sqlc.arg(published_only)::bool OR d.status = 'published'`)。`ponytail:` コメントは残す
- [X] T016 [US4] `just be-gen` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/articles.sql.go`、`frontend/src/shared/api/openapi.gen.ts` を再生成する (T014, T015 の後)。`listAllArticleDomains` の params 型が `ListAllArticleDomainsParams` として `Q *string` / `Limit *int` を持つか確かめる
- [X] T017 [US4] `backend/internal/handler/handler.go`: `ListArticleDomains` の中身を非公開メソッド `articleDomains(ctx, q *string, limit *int, publishedOnly bool) ([]api.DomainCount, error)` に移し (既定値 20 のコメントも移す)、`ListArticleDomains` は `publishedOnly = true`、新しい `ListAllArticleDomains` は `false` で呼んで、それぞれの `200JSONResponse{Domains: ...}` を返す。`ListAllArticleDomains` に `// ponytail: ログインできるのは管理者だけなので bearerAuth で足りる。一般ユーザーを足したら管理者の判定を足す` を付ける (T016 の後)
- [X] T018 [US4] `backend/cmd/server/main_test.go` の `TestRouter` の表で、`{"GET", "/articles/domains", "", http.StatusUnauthorized, api.Problemsunauthorized},` の後に `{"GET", "/articles/domains/all", "", http.StatusUnauthorized, api.Problemsunauthorized},` を足す。`TestBearerAuth` の `limit=51` の行は `/articles/domains` のままでよい (2 つの操作は同じ `DomainLimit` を参照する)
- [X] T019 [P] [US4] `frontend/src/shared/api/list-article-domains.ts`: 入力の zod スキーマを同じファイル内の定数に出し、パスを受け取って `backendFetch` する非公開の関数にまとめる。`listArticleDomains` (`/articles/domains`、公開分) と `listAllArticleDomains` (`/articles/domains/all`、全件) の 2 つの `createServerFn` を export する。公開分のトークンには `// ponytail: 一般ユーザーのセッションができたら、管理者に限らないトークンに替える` を付ける。`frontend/src/shared/api/index.ts` の export に `listAllArticleDomains` を足す (T016 の後)
- [X] T020 [US4] `just lint && just test`、`just fe-typecheck`、`just be-gen` で差分なしを通す
- [X] T021 [US4] quickstart.md「2. 手動確認」の 1〜14 を、今回のコードの backend に curl で流す (全件は `/all`)。確認用に入れたデータは消す
- [X] T022 [US4] `TODO.md` の 007 の行に、公開分 (`/articles/domains`) と全件 (`/articles/domains/all`) に分けたことを足す

**Checkpoint**: US4 の受け入れシナリオ 1〜6 を満たし、US1〜3 は `/articles/domains/all` で同じ結果になる。

---

## Dependencies & Execution Order

- **Phase 2**: T001 ∥ T002 → T003 → T004 ∥ T005 → T006
- **Phase 3〜5**: Phase 2 の後。T008 と T010 は同じファイル (`main_test.go`) の別の表なので、順に編集する。手動確認 (T007 / T009 / T011) は `just be-dev` を起動したまままとめて流せる
- **Phase 6**: Phase 2〜5 の後
- **Phase 7**: Phase 6 の後。T014 ∥ T015 → T016 → T017 ∥ T019 → T018 → T020 → T021 → T022

## Parallel Example

```text
# Phase 2 の開始
T001 openapi.yaml に /articles/domains と DomainList / DomainCount
T002 db/queries/articles.sql に ListArticleDomains

# 再生成 (T003) の後
T004 handler.go の ListArticleDomains
T005 schemas.ts の domainCount / domainList
```

## Implementation Strategy

1. Phase 2 を通して、`just lint && just test` と `just fe-typecheck` が通る状態にする
2. US3 (T010) と US1 (T007) で、管理者に一覧が返り未ログインは拒否される MVP を確かめる
3. US2 (T008, T009) で絞り込みと境界を確かめる
4. Phase 6 で完了の判定を通す
5. Phase 7 で公開分を足し、全件を `/all` に移して、quickstart を流し直す。コミットは頼まれたときだけ
