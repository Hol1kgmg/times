---

description: "Task list for 010-digest-rss-feed"
---

# Tasks: Digest の公開を知らせる RSS フィード

**Input**: `specs/010-digest-rss-feed/` の plan.md、spec.md、research.md、data-model.md、contracts/

**Tests**: constitution V と `.agents/rules/quality.md` に従い、分岐・境界のあるロジックに最小のテストを 1 件ずつ書く。新しい e2e は足さず、SQL を変える `digest-new` / `digest-edit` を回す。

**Format**: `[ID] [P?] [Story] Description`。[P] は別ファイルで前のタスクに依存しないもの。

## Phase 1: Setup

- [x] T001 `golang.org/x/image` を backend に足す (`go get golang.org/x/image@latest` → `just be-tidy`)。`backend/go.mod` / `backend/go.sum`
- [x] T002 [P] `justfile` に `be-og-font` を足す。`fe-font-subset` と同じ pinned の google/fonts (`130fcfb0…/ofl/kleeone/KleeOne-SemiBold.ttf`) を取り、`pyftsubset --text="0123456789月日()日月火水木金土"` で TTF のまま `backend/internal/feed/date-600.ttf` に書き出す。実行して生成物を置く
- [x] T003 [P] `frontend/scripts/og-image.ts` に、中央を日付用に空けてロゴと説明文を置き直した下地を `../backend/internal/feed/og-base.png` (1200×630) に書き出す処理を足す。既存の `public/og.png` の出力は変えない。レイアウトは仮で、デザインは試作を見て決める (spec Assumptions)。`just fe-og-image` で生成物を置き、`justfile` の `fe-og-image` の説明を直す

---

## Phase 2: Foundational (全ストーリーの前提)

- [x] T004 `backend/db/migrations/000011_digest_published_at.up.sql` / `.down.sql` を作る。up: `ALTER TABLE digests ADD COLUMN published_at timestamptz;` と `CHECK (status <> 'draft' OR published_at IS NULL)` (名前付き)。既存行は埋めない (FR-008)。down は CHECK と列を落とす
- [x] T005 `backend/db/queries/digests.sql` を変える (data-model.md の遷移表どおり)
  - `CreateDigest`: `published_at` を `CASE WHEN $3 = 'published' THEN now() END` にする
  - `UpdateDigest`: `SET published_at = CASE WHEN status = 'draft' AND COALESCE(sqlc.narg(status), status) = 'published' THEN now() ELSE published_at END` を足す (右辺の `status` は更新前の値)
  - `ListFeedDigests` を足す: `status = 'published' AND published_at IS NOT NULL AND created_by IN (SELECT id FROM users WHERE lower(login) = lower(sqlc.arg(admin_login)))` を `published_at DESC LIMIT 20`。返すのは `id, entry_date, published_at`
  - `GetFeedDigestByDate` を足す: 同じ条件 + `entry_date = sqlc.arg(entry_date)`、`LIMIT 1`
- [x] T006 `backend/api/openapi.yaml` に `getFeed` (`/feed`)、`getFeedImage` (`/feed/images/{entryDate}`)、Problem.type の `/problems/future-publish` を足す (contracts/openapi-diff.md)。`createDigest` / `updateDigest` の 400 の description に future-publish を書き足す
- [x] T007 `just be-gen` で `backend/internal/api` と `backend/internal/db` を再生成する。`frontend/src/shared/api/openapi.gen.ts` も更新される
- [x] T008 [P] `backend/internal/apperr/apperr.go` の `Types` に `"/problems/future-publish": http.StatusBadRequest` と `FuturePublish(detail string) error` を足す (Types と openapi の enum の一致は既存テストが見る)
- [x] T009 [P] `frontend/src/shared/api/schemas.ts` の `problem` の type に `/problems/future-publish` を足す

---

## Phase 3: User Story 1 - 公開すると通知が届く (P1) 🎯 MVP

**Goal**: 公開で登録した・下書きから公開にした Digest が、日付入りの画像付きで `/feed.xml` の先頭に載り、リンク先の日ごとのページから人はトップへ移る。

**Independent Test**: quickstart.md の 1・4・5。

### backend

- [x] T010 [P] [US1] `backend/internal/handler/feed.go` に `formatEntryDate(t time.Time) string` (`10月20日(火)`。曜日は `日月火水木金土`、日付は UTC として読む) と `toRSS(rows []db.ListFeedDigestsRow) ([]byte, error)` を書く。`encoding/xml` で contracts/rss.md の形を出す。サイト URL `https://z-times.dev` と画像の版 `imageVersion = 1` は定数。pubDate は `time.FixedZone("JST", 9*60*60)` で RFC 1123Z。0 件でも channel を返す
- [x] T011 [P] [US1] `backend/internal/handler/feed_test.go` に 1 件: 2 行を渡すと並びが保たれ、title が `10月20日(火)の times 投稿が公開されました`、link が `/digest/2026-10-20`、guid が `urn:uuid:<id>`、画像 URL に `?v=1` が付く
- [x] T012 [US1] `backend/internal/handler/feed.go` に `GetFeed` を書く。`ListFeedDigests(adminLogin)` → `toRSS` → `api.GetFeed200ApplicationrssPlusxmlResponse` (生成された型名に合わせる)
- [x] T013 [P] [US1] `backend/internal/feed/render.go` に `Render(label string) ([]byte, error)` を書く。`og-base.png` と `date-600.ttf` を `go:embed` し、`golang.org/x/image/font/opentype` で label を中央に描いて PNG にする。フォントの大きさ・色・位置は定数 (色は `global.css` の `--color-text` と同じ値。トークンは Go から読めないので値をコメントで指す)
- [x] T014 [P] [US1] `backend/internal/feed/render_test.go` に 1 件: `Render("10月20日(火)")` が 1200×630 の PNG を返し、中央付近に下地と違う画素がある
- [x] T015 [US1] `backend/internal/handler/feed.go` に `GetFeedImage` を書く。`GetFeedDigestByDate` が `pgx.ErrNoRows` なら `apperr.NotFound`、あれば `feed.Render(formatEntryDate(d.EntryDate))` を `image/png` で返す
- [x] T016 [US1] `backend/cmd/server/main_test.go` に router テストを 1 件: stub で `GetFeed` / `GetFeedImage` を差し替え、`GET /feed` が 200 で `Content-Type: application/rss+xml`、`GET /feed/images/not-a-date` が 400 の Problem になる

### frontend

- [x] T017 [P] [US1] `frontend/src/shared/api/cache.server.ts` に `cachedResponse(key, ttlSeconds, load: () => Promise<Response>)` を足す。200 だけ `cache-control: public, max-age=<ttl>` を付けて put し、それ以外は載せずに返す。vite dev (caches なし) は素通し。`cache.server.test.ts` に 1 件 (200 は 2 回目に load を呼ばない、404 は毎回呼ぶ)
- [x] T018 [P] [US1] `frontend/src/shared/api/feed.server.ts` に `loadFeedXml()` (`cachedJson("https://cache.times.invalid/feed", 300, …)` で `backendFetch("/feed")` の text を持つ) と `isInFeed(xml: string, date: string): boolean` (`xml.includes(\`/digest/${date}</link>\`)`) を書き、`index.server.ts` から出す。`feed.server.test.ts` に 1 件 (載っている日付は true、`2026-10-2` のような前方一致は false)
- [x] T019 [US1] `frontend/src/app/routes/feed[.]xml.ts` を server route で作る (`createFileRoute("/feed.xml")({ server: { handlers: { GET } } })`)。`loadFeedXml()` を `application/rss+xml; charset=utf-8`、`cache-control: public, max-age=300` で返す
- [x] T020 [US1] `frontend/src/app/routes/feed.images.$file.ts` を server route で作る。`$file` を zod `z.string().regex(/^\d{4}-\d{2}-\d{2}\.png$/)` で検証 (違えば 404)。`isInFeed(await loadFeedXml(), date)` でなければ backend に行かず 404。あれば `cachedResponse(\`https://cache.times.invalid/feed/images/${date}\`, 300, () => backendFetchRaw(\`/feed/images/${date}\`))`。キーにクエリを入れない (research R7)
- [x] T021 [US1] `frontend/src/app/routes/digest.$date.tsx` を shell の外に作る。`params.date` を zod の日付で検証し、loader (サーバー関数) が `isInFeed` でなければ `notFound()`。`head` で `og:title` (通知の題名)、`og:image` (`${SITE_URL}/feed/images/<date>.png?v=1`、1200×630)、`robots: noindex`、`link rel=canonical` (`${SITE_URL}/`)、`<meta http-equiv="refresh" content="0; url=/">`。本文はトップへのリンク 1 つ (`font-family: var(--font-dynamic)` は固定文字だけなので不要)。題名の日付は `shared/ui/digest-post` の `dateFormat` で作り、backend と同じ形にする
- [x] T022 [US1] `__root.tsx` の `og:image` と T021 の `og:image` が両方出ないかを `curl` で確かめ、出るなら T021 側で上書きされる形に直す (research R6)
- [x] T023 [US1] `frontend/src/app/routes/__root.tsx` の head に `<link rel="alternate" type="application/rss+xml" title="z_times.dev" href="/feed.xml">` を足す
- [x] T024 [US1] `just fe-generate-routes` で route tree を更新する

**Checkpoint**: quickstart.md の 1・4・5 が通る。

---

## Phase 4: User Story 2 - 公開し直しでは通知しない (P1)

**Goal**: 非公開 → 公開で公開時刻が変わらず、通知が増えない。

**Independent Test**: quickstart.md の 2。

- [ ] T025 [US2] T005 の `UpdateDigest` の CASE が「private → published では `published_at` を変えない」「published → private → published で最初の時刻を保つ」ことを、quickstart.md の 2 と `psql` の `SELECT status, published_at FROM digests` で確かめる (DB に触るテストは書かない、constitution V)。追加のコードはない

**Checkpoint**: quickstart.md の 2 が通る。

---

## Phase 5: User Story 3 - 未来の日付は公開できない (P2)

**Goal**: 今日 (JST) より後の日付で公開になる保存を断り、日付欄に出す。

**Independent Test**: quickstart.md の 3。

- [x] T026 [P] [US3] `backend/internal/handler/handler.go` に `publishable(d db.Digest, now time.Time) bool` (`d.Status != "published"` か、`d.EntryDate` が `now` の JST の日付以下なら true) を書き、`CreateDigest` と `UpdateDigest` で書き込み直後の行にかけ、false なら `apperr.FuturePublish("cannot publish a digest dated after today (JST)")` を返す (`defer tx.Rollback` で巻き戻る)
- [x] T027 [P] [US3] `backend/internal/handler/handler_test.go` に 1 件 (表駆動): JST 2026-11-03 23:59 に 11-03 は true、11-04 は false、JST 2026-11-04 00:00 (UTC 11-03 15:00) に 11-04 は true、下書きの 11-04 は true
- [x] T028 [P] [US3] `frontend/src/pages/digest-editor/api/rejection-of.ts` に `{ reason: "future-publish" }` を足し、`rejection-of.test.ts` に 1 件
- [x] T029 [US3] `frontend/src/pages/digest-editor/ui/digest-editor-page.tsx` で `future-publish` を受けたら、`digest-already-exists` と同じく日付欄を `--color-danger` にし、「未来の日付は公開できないです。日付を直すか、下書きで保存してください」を出す。`save` の返り値の型 (`Rejection`) に合わせて分岐を足す

**Checkpoint**: quickstart.md の 3 が通る。

---

## Phase 6: Polish

- [x] T030 `docs/` の backend の API 一覧・環境変数の説明に `/feed` と `/feed/images/{entryDate}` があれば足す (なければ触らない)。`backend/api/http/` に `feed.http` を足す
- [x] T031 完了判定を回す: `just be-gen` (差分なし)、`just lint && just test`、`just fe-typecheck`
- [x] T032 e2e を回す: `.agents/rules/quality.md` の手順で backend を e2e 用に切り替え、`just fe-test-e2e digest-new` と `just fe-test-e2e digest-edit` (CreateDigest / UpdateDigest の SQL を変えたため)。終わったら `docker compose stop api` と `just be-dev` で戻す
- [x] T033 試作の画像 (`/feed/images/<日付>.png`) をユーザーに見せ、レイアウトを決める。決まったら T003 の HTML/CSS と T013 の定数を直し、`imageVersion` はリリース前なので 1 のまま
- [ ] T034 本番のデプロイ後、quickstart.md の 6 の WAF のレート制限の手順をユーザーに案内する (ダッシュボードで操作、CLI は使わない)
- [x] T035 `TODO.md` に関係する項目があれば `[x]` にして日付と要点を添える

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → (US2, US3)
- T004 → T005 → T006 → T007 → それ以降の backend
- T008・T009 は T006 の後ならいつでも
- US2 は US1 の T005 に乗るだけで、コードの追加はない
- US3 は Phase 2 の後なら US1 と並べて進められる (handler.go の Create / Update だけを触る)
- T012・T015 が入るまで `api.StrictServerInterface` を満たさずビルドが落ちるので、Phase 2 と US1 の backend は続けて入れる

## Parallel Example: User Story 1

```text
T010 feed.go の変換関数   T013 internal/feed/render.go   T017 cache.server.ts   T018 feed.server.ts
T011 feed_test.go         T014 render_test.go
```

## Implementation Strategy

1. Phase 1・2 → US1 で MVP (フィード・画像・日ごとのページ)
2. US3 (未来の日付を断る) を足す。US1 の通知の正しさの前提なので、リリースは US1 と同時にする
3. US2 は確認だけ
4. Polish で画像のデザインを決め、WAF を設定する
