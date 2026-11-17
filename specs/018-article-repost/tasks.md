---

description: "Task list for 記事の再掲載と関連記事"
---

# Tasks: 記事の再掲載と関連記事

**Input**: Design documents from `/specs/018-article-repost/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, contracts/ui.md, quickstart.md

**Tests**: plan.md の Testing に従う (go test の振り分けと変換、Vitest の拒否の変換と search、e2e 1 本)。Storybook の story はデモで、自動テストではない。

**Organization**: Phase 1 は Storybook のデモ (UI の見た目だけ)。**ユーザーがデモを確認して承認するまで Phase 2 以降に進まない。** Phase 2 以降はユーザーストーリーごと。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで、未完了のタスクに依存しない
- **[Story]**: spec.md のユーザーストーリー (US1, US2, US3)

---

## Phase 1: Storybook のデモ (UI の見た目) 🎯 先行して確認する

**Purpose**: 再掲載を示す UI (公開ページの投稿・編集画面の記事行のメタ行) を、backend や OpenAPI に触れずに Storybook で見せる。

**Gate**: `just fe-storybook` で contracts/ui.md の 6 story をライト・ダークで見てもらい、承認を得る。直しが出たらこのフェーズの中で直す。

- [X] T001 [P] `formatFirstPublished(date: string) => \`再掲載 · ${formatEntryDate(date)}に初掲載\`` を frontend/src/shared/lib/entry-date.ts に足し、今年と去年の 2 件のテストを frontend/src/shared/lib/entry-date.test.ts に足す (今年以外は年を付ける、FR-010)
- [X] T002 DigestPost の記事の型に任意の `firstPublishedOn?: string` を足し、親の記事行 (`Entry` の `ArticleLink` の下) でだけ、タイトルの下のメタ行に `formatFirstPublished` の文字を出す。押せる要素にしない (FR-011)。子の行には出さない。frontend/src/shared/ui/digest-post.tsx (OpenAPI の生成型はまだ変えないので、`NewArticle & { firstPublishedOn?: string }` をこのファイルの中で受ける)
- [X] T003 メタ行の見た目を frontend/src/shared/ui/digest-post.module.css に足す: `composes: t-meta from global`、`color: var(--color-text-faint)`、`font-family: var(--font-dynamic)`、左端はタイトルの文字にそろえる。AI のアイコン・炎・吹き出しの幅の決まり (frontend-ui-design のホットトピック・AI のアイコンの項) に触れない
- [X] T004 [P] LinkMeta に `firstPublishedOn?: string` (faint で `formatFirstPublished`)、`reposted: boolean` (「再掲載として登録しました」、`.suggested` と同じ `--color-accent`)、`needsChild: boolean` (「再掲載には新しい記事を子に付けてください」、`.error` と同じ `--color-danger`) を足す。frontend/src/pages/digest-editor/ui/link-meta.tsx と frontend/src/pages/digest-editor/ui/link-meta.module.css
- [X] T005 LinkMeta の新しい props を、今の呼び出し元 frontend/src/pages/digest-editor/ui/draft-card.tsx で `reposted={false}` `needsChild={false}` として渡し、型を通す (つなぎ込みは Phase 3・5)
- [X] T006 [P] story `Repost` (再掲載の親「2026-10-03」+ 新しい子 2 件、HOT 付きの再掲載を 1 件含む)、`RepostWithAskAi` (`ai: { shown: true }`) を frontend/src/shared/ui/digest-post.stories.tsx に足す
- [X] T007 [P] story `Reposted` (印だけ)、`RepostNotice` (印 + `reposted`)、`RepostNeedsChild`、`Registered` を frontend/src/pages/digest-editor/ui/link-meta.stories.tsx に足す
- [X] T008 `just fe-typecheck` と `just lint` を通し、`just fe-storybook` を起動してユーザーにデモの確認を頼む。**承認まで止まる**

**Checkpoint**: デモの承認。ここで UI の形 (印の位置・文言・色) を確定させる

---

## Phase 2: Foundational (データ構造の移行)

**Purpose**: `articles` と `digest_articles` を分け、今の機能 (登録・編集・表示) を同じ振る舞いのまま新しい形で動かす。再掲載はまだ通さない。

**⚠️ CRITICAL**: このフェーズが終わるまで US1〜US3 に入らない

- [X] T009 `just db-migrate-new split_digest_articles` で backend/db/migrations/000013_split_digest_articles.{up,down}.sql を作る。up: `digest_articles (digest_id uuid NOT NULL REFERENCES digests (id) ON DELETE CASCADE, article_id uuid NOT NULL REFERENCES articles (id), parent_id uuid, position integer NOT NULL, is_hot boolean NOT NULL DEFAULT false, PRIMARY KEY (digest_id, article_id), UNIQUE (digest_id, position), FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id) ON DELETE CASCADE, CHECK (parent_id <> article_id))` を作り、`INSERT INTO digest_articles SELECT a.digest_id, a.id, l.parent_id, a.position, a.is_hot FROM articles a LEFT JOIN article_links l ON l.child_id = a.id` で移し、`DROP TABLE article_links` と `articles` の `digest_id` / `position` / `is_hot` を消す。down: 各記事のいちばん古い掲載を `articles` に戻し、`article_links` を作り直す。再掲載を捨てることを 1 行のコメントに残す (data-model.md の移行)
- [X] T010 backend/db/queries/digests.sql を書き換える: `ListArticlesByDigest` を `digest_articles` と join して `parent_id` / `position` / `is_hot` を返す 1 本にし (`ORDER BY position`)、`DeleteDigestArticles` (`WHERE digest_id = $1`)、`CreateDigestArticle`、`UpsertArticle` (`INSERT INTO articles (category, title, url, created_by) ... ON CONFLICT (created_by, url) DO UPDATE SET category = EXCLUDED.category, title = EXCLUDED.title RETURNING *`)、`DeleteOrphanArticles` (`created_by = $1 AND NOT EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = articles.id)`) を置く。`DeleteArticlesNotIn` / `DeleteArticleLinksByDigest` / `CreateArticleLink` / `ListArticleLinksByDigest` を消す。`ListRegisteredURLs` は「この Digest にまだ載っていない登録済みの記事」(`NOT EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = a.id AND da.digest_id = $digest)`) に書き換える
- [X] T011 [P] backend/db/queries/articles.sql の `ListArticleDomains` を記事の数で数える形にする (`published_only` は「公開済み Digest に掲載がある」を `EXISTS` で見る、research R8)
- [X] T012 `just be-gen` で backend/internal/db を作り直す
- [X] T013 backend/internal/handler/handler.go の `UpdateDigest` / `CreateDigest` / `insertArticles` / `withArticles` / `toDigest` を新しいクエリに合わせる: 保存は `DeleteDigestArticles` → 記事ごとに `UpsertArticle` と `CreateDigestArticle` (子は親の `is_hot` を写す、`position` は通し番号) → `DeleteOrphanArticles`。`toDigest` は `parent_id` から親子を組む。この時点では登録済みの URL は今どおりすべて `url-already-registered` で断る
- [X] T014 [P] backend/internal/handler/handler_test.go の `toDigest` のテストを、`parent_id` から親子を組み、子の順が `position` の順になる形に直す
- [X] T015 [P] backend/cmd/seed/main.go を `CreateArticleLink` から `CreateDigestArticle` に書き換える。日付を入れ直すとき `DeleteOrphanArticles` も呼ぶ
- [X] T016 `just db-reset && just db-migrate up && just db-seed`、`just lint && just test` を通し、quickstart.md の 1 (移行で表示が変わらない) と、`just fe-test-e2e digest-new digest-edit` (quality.md の手順で be-dev-e2e に切り替える) を通す

**Checkpoint**: 今の機能が新しい形で同じに動く

---

## Phase 3: User Story 1 - 過去の記事の続報を、その記事の子として載せる (Priority: P1) 🎯 MVP

**Goal**: 公開済みの記事を親、新しい記事を子にして保存すると通り、編集画面の行に「再掲載として登録しました」が出る

**Independent Test**: quickstart.md の 2

- [X] T017 [US1] backend/api/openapi.yaml に `SavedDigest` (`allOf: [Digest, {required: [repostedUrls], properties: {repostedUrls: {type: array, items: {type: string}}}}]`) を足し、`POST /digests` の `201` と `PUT /digests/{entryDate}` の `200` をそれに変えて `just be-gen` (contracts/openapi.md)
- [X] T018 [US1] T010 の登録済みの判定のクエリに、「この Digest 以外の `status = 'published'` の Digest に掲載がある」を `published_elsewhere` として足し、`just be-gen`。backend/db/queries/digests.sql
- [X] T019 [US1] 純粋関数 `classifyReposts(articles []api.NewArticle, registered map[string]bool /* url → published_elsewhere */) (reposted []string, rejected []string)` を backend/internal/handler/handler.go に置く: 子として入れた・公開の掲載がない・子に登録済みの URL がある → `rejected`、親で新規の子が 1 件以上・公開の掲載がある → `reposted`。子がない親は Phase 5 で分けるので、この時点では `rejected` に入れる
- [X] T020 [US1] `classifyReposts` のテストを backend/internal/handler/handler_test.go に足す (通る 1 件、子として入れた 1 件、公開の掲載がない 1 件、子に登録済みの URL 1 件)
- [X] T021 [US1] `insertArticles` で `classifyReposts` を使い、`rejected` があれば `apperr.URLAlreadyRegistered(rejected)`、なければ保存して `repostedUrls` を `SavedDigest` で返す。判定と書き込みの間の並行保存の抜けと、編集で再掲載を子へ動かす抜けを `ponytail:` コメントに残す (research R4)。backend/internal/handler/handler.go
- [X] T022 [US1] frontend/src/shared/api/schemas.ts に `savedDigest = digest.extend({ repostedUrls: z.string().array() }) satisfies z.ZodType<Schemas["SavedDigest"]>` を足し、frontend/src/shared/api の公開 API から出す
- [X] T023 [US1] frontend/src/pages/digest-editor/api/create-digest.ts と update-digest.ts で、成功のレスポンスを `savedDigest` で parse し、`repostedUrls` が空でなければ `redirect({ to: "/admin/digests/$date/edit", params: { date }, search: { reposted: repostedUrls } })`、空なら今の遷移先のまま
- [X] T024 [US1] frontend/src/app/routes/_shell/admin.digests.$date.edit.tsx に `validateSearch: z.object({ reposted: z.url().array().default([]) })` を足し、編集画面へ渡す
- [X] T025 [US1] frontend/src/pages/digest-editor/ui/digest-editor-page.tsx と draft-card.tsx で、`reposted` の URL の集合を `CardActions` に足し、親の行の `LinkMeta` の `reposted` に渡す
- [X] T026 [US1] e2e frontend/e2e/digest-repost.spec.ts を 1 本書く: 公開済みの Digest に載っている記事を親、新しい URL を子にして登録 → 編集画面の行に「再掲載として登録しました」→ トップで親の下に子が並ぶ。`loggedInState` を前提に使う

**Checkpoint**: 再掲載を保存でき、編集画面で案内が出る

---

## Phase 4: User Story 2 - 当日の Digest で、再掲載の親と新しい子を一緒に読む (Priority: P1)

**Goal**: 再掲載の親に「再掲載」の印が付き、前の日の Digest には後の子が出ない

**Independent Test**: quickstart.md の 3

- [X] T027 [US2] backend/api/openapi.yaml の `Article` に `firstPublishedOn` (`type: string, format: date`、required に入れない) を足す。`ChildArticle` には足さない (contracts/openapi.md)
- [X] T028 [US2] `ListArticlesByDigest` に `first_published_on` を足す: 同じ記事の掲載のうち、`status = 'published'` で、表示中の Digest より前の `entry_date` の最小値 (FR-010)。`just be-gen`。backend/db/queries/digests.sql
- [X] T029 [US2] `toDigest` で `first_published_on` を親の `Article.FirstPublishedOn` にだけ写し、テストに 1 件足す (親に写る・子には写らない)。backend/internal/handler/handler.go と handler_test.go
- [X] T030 [US2] frontend/src/shared/api/schemas.ts の `article` に `firstPublishedOn: z.iso.date().optional()` を足し、T002 で DigestPost に置いた仮の型を生成型 (`Article`) に置き換える
- [X] T031 [US2] 編集画面の記事行にも印を出す: frontend/src/pages/digest-editor/model/board.ts の `Draft` に `firstPublishedOn?: string` を足し、読み込んだ Digest から写す。draft-card.tsx で親の `LinkMeta` に渡す。プレビュー (`DigestPost` の下書きの型) にも渡す
- [X] T032 [US2] T026 の e2e に、トップの親の行に「再掲載」が出ることの確認を 1 行足す (frontend/e2e/digest-repost.spec.ts)

**Checkpoint**: 公開ページ・編集画面・プレビューで印が出る

---

## Phase 5: User Story 3 - 再掲載の誤りを保存時に止める (Priority: P2)

**Goal**: 子のない再掲載を、何を直せばよいか分かる形で断る

**Independent Test**: quickstart.md の 4

- [X] T033 [US3] backend/api/openapi.yaml の `Problem.type` に `/problems/repost-needs-child` を足し、`duplicateUrls` の description を「url-already-registered と repost-needs-child のときだけ入る」に直して `just be-gen`
- [X] T034 [US3] backend/internal/apperr/apperr.go に `RepostNeedsChild(urls []string)` を足し、Problem の形のテストを 1 件足す (apperr の既存テストの隣)
- [X] T035 [US3] `classifyReposts` で子のない親を `needsChild` に分けて返し、`insertArticles` は `rejected` を先に、なければ `needsChild` を `apperr.RepostNeedsChild` で返す (data-model.md の業務ルール)。T020 のテストに子のない親の 1 件を足す
- [X] T036 [US3] frontend/src/shared/api/schemas.ts の problem の type に `/problems/repost-needs-child` を足し、frontend/src/pages/digest-editor/api/rejection-of.ts に `{ reason: "repost-needs-child"; duplicateUrls: string[] }` を足す。rejection-of.test.ts に 1 件足す
- [X] T037 [US3] digest-editor-page.tsx で `repost-needs-child` の URL を集合に持ち、draft-card.tsx で親の行の `LinkMeta` の `needsChild` に渡す。該当の行を直す (子を付ける・外す) と印が消える扱いは、今の `registered` と同じにする

**Checkpoint**: 3 つの断り方がそれぞれの行に出る

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T038 [P] packages/project/.apm/instructions/frontend-ui-design.instructions.md の「Digest の投稿」の節に、再掲載の親の行はタイトルの下に「再掲載」のメタ行 (`.t-meta` の faint、押せない) を出すことを 1 項目で足す (Phase 1 で承認した形)
- [X] T039 [P] adr/backend/0008-split-articles-into-articles-and-digest-articles.md の status を `accepted` にし、adr/backend/README.md の表も直す
- [X] T040 quality.md の完了の判定を通す: `just be-gen` (差分なし)、`just lint && just test`、`just fe-typecheck`、`just fe-test-e2e digest-repost digest-new digest-edit`
- [X] T041 quickstart.md の 1〜5 を手で確かめる

---

## 見直し (2026-11-17): 再掲載を明示的な参照にする

Phase 1〜6 は初版の方針で完了した。spec の Revision (research R10〜R13) で次を置き換える: 自動の再掲載の判定 (T019・T021)、保存後の案内 (T017・T022〜T025)、子のない再掲載の拒否 (Phase 5)、公開ページの印 (T002・T003)。Phase 7 以降で直す。

## Phase 7: Storybook のデモ (見直し後の見た目) 🎯 先行して確認する

**Gate**: `just fe-storybook` で contracts/ui.md の 7 story をライト・ダークで見てもらい、承認を得る。

- [X] T042 [P] DigestPost の再掲載の親を細い行にする (contracts/ui.md の DigestPost): frontend/src/shared/ui/digest-post.tsx と digest-post.module.css。OpenAPI の生成型はまだ変えないので、`repost` と子の `hot` はこのファイルの中の型で受ける
- [X] T043 DigestPost の HOT の印を FR-017 の形にする (HOT でない親の下の HOT の子にも付ける)。frontend/src/shared/ui/digest-post.tsx
- [X] T044 [P] LinkMeta の `reposted` / `needsChild` を `repost` / `converted` / `unavailable` に替える。frontend/src/pages/digest-editor/ui/link-meta.tsx と link-meta.module.css、呼び出し元の draft-card.tsx は今の値で型を通す
- [X] T045 [P] story を contracts/ui.md の表に揃える: digest-post.stories.tsx (`Repost` / `RepostWithAskAi` を直し `HotPatterns` を足す)、link-meta.stories.tsx (`Repost` / `RepostConverted` / `RepostUnavailable` / `Registered`)
- [X] T046 `just fe-typecheck` と `just lint` を通し、`just fe-storybook` を起動してユーザーにデモの確認を頼む。**承認まで止まる**

## Phase 8: backend (参照の再掲載と子の HOT)

- [X] T047 backend/db/migrations/000013_split_digest_articles.up.sql に `is_repost`、`CHECK (NOT is_repost OR (parent_id IS NULL AND NOT is_hot))`、`UNIQUE (article_id) WHERE NOT is_repost` を足す。down は再掲載でない掲載を戻す形に直す (000013 は main に未マージなので書き換える)
- [X] T048 backend/api/openapi.yaml を contracts/openapi.md に合わせる (`RepostArticle`、`oneOf`、`Article.repost`、子の `hot`、`Problem.repostable`、`repost-unavailable`。`SavedDigest` と `repost-needs-child` を消す)。`just be-gen`
- [X] T049 backend/db/queries/digests.sql: `ListRegisteredURLs` を、記事の id・カテゴリ・タイトル・この Digest に載っているか・前の日付の公開済みの最小の日付を返す形にする。`CreateDigestArticle` に `is_repost`。`ListArticlesByDigest` に `is_repost` を足し、`first_published_on` は再掲載の行だけ引く。`just be-gen`
- [X] T050 backend/internal/handler/handler.go: 振り分けを data-model.md の業務ルールの表の純粋関数にし、`saveArticles` で再掲載は upsert せず掲載だけ作る。子の HOT は親か子自身。`toDigest` で再掲載の投稿のカテゴリを先頭の子から取り、子の `hot` を写す。`apperr.RepostNeedsChild` を `apperr.RepostUnavailable` に、`URLAlreadyRegistered` に `repostable` を足す。事実と違う `ponytail:` コメントと、何をするかの説明のコメントを消す
- [X] T051 [P] handler_test.go: 振り分けの表の行ごとに 1 件 (子として入れた・前の公開がない・再掲載にできる・再掲載先がない・子のないカテゴリ違い・通る)、`toDigest` の再掲載のカテゴリと子の HOT に 1 件。apperr の Problem の形 (`repostable`、`repost-unavailable`) に 1 件。cmd/server/main_test.go に `oneOf` の両方に当たる要素が 400 になる 1 件
- [X] T052 [P] backend/cmd/seed/main.go の子の HOT を「親か子自身の 🔥」にする。seed.md に同じ URL を 2 日に入れる記事はないので再掲載は入れない (入れると `digest_articles_original_key` で止まる)
- [X] T053 `just be-gen` (差分なし)、`just lint && just test`

## Phase 9: frontend (自動の切り替えと再掲載の行)

- [X] T054 frontend/src/shared/api/schemas.ts を新しい OpenAPI に合わせる (`article.repost`、子の `hot`、problem の `repostable` と `repost-unavailable`。`savedDigest` を消す)。digest-post.tsx の仮の型を生成型に置き換える
- [X] T055 create-digest.ts / update-digest.ts と admin.digests.$date.edit.tsx を初版の前の遷移に戻す (`savedDigest`・`?reposted` を消す)
- [X] T056 rejection-of.ts を contracts/ui.md に合わせ、rejection-of.test.ts に `repostable` と `repost-unavailable` の 1 件ずつ
- [X] T057 board.ts: `Draft.repost`、子の `hot`、断られた行を再掲載に切り替える純粋関数 (子がなければカテゴリも元に戻す)、子が 0 件になったらカテゴリを元に戻す、送る形 (`RepostArticle`) への変換。board.test.ts に切り替えと送る形の 1 件ずつ
- [X] T058 digest-editor-page.tsx と draft-card.tsx: 断られるたびに `registered` / `converted` / `unavailable` を入れ替える、再掲載の行のメニューとカテゴリの固定、子の行の HOT のメニュー (contracts/ui.md の DraftCard)
- [X] T059 frontend/e2e/digest-repost.spec.ts を書き直す: 公開済みの記事を親・新しい URL を子にして保存 → 断られて行が「再掲載にしました」→ 保存し直す → トップで細い親の下に子が並ぶ

## Phase 10: Polish

- [X] T060 [P] packages/project/.apm/instructions/frontend-ui-design.instructions.md の「Digest の投稿」の再掲載の項目を、細い親の行と子の HOT の印の決まりに書き直す (Phase 7 で承認した形)
- [X] T061 [P] adr/backend/0008 に、再掲載を参照の掲載として持つこと (`is_repost`、記事を書き換えない) を足す
- [X] T062 quality.md の完了の判定を通す: `just be-gen` (差分なし)、`just lint && just test`、`just fe-typecheck`、`just fe-test-e2e digest-repost digest-new digest-edit`
- [X] T063 quickstart.md を見直し後の流れに直し、手で確かめる

---

## Dependencies & Execution Order

- **Phase 1 (デモ)**: 依存なし。**承認がゲート**
- **Phase 2 (移行)**: Phase 1 の承認の後。US1〜US3 をすべて止める
- **Phase 3 (US1)**: Phase 2 の後
- **Phase 4 (US2)**: Phase 2 の後。表示は US1 なしでも、移行後のデータに印が付かないことは確かめられるが、印の確認には再掲載のデータが要るので US1 の後に回す
- **Phase 5 (US3)**: Phase 3 の後 (`classifyReposts` を広げる)
- **Phase 6**: すべての後
- **Phase 7 (見直しのデモ)**: **承認がゲート**
- **Phase 8 (backend)**: Phase 7 の承認の後
- **Phase 9 (frontend)**: Phase 8 の後 (生成型が要る)
- **Phase 10**: すべての後

### Parallel Opportunities

- Phase 1: T001 / T004 / T006 / T007 は別ファイル (T006 は T002・T003、T007 は T004 の後に見た目が確定する)
- Phase 2: T011 / T014 / T015 は T010・T012 の後に並行
- Phase 6: T038 / T039

## Parallel Example: Phase 1

```text
Task: "T001 formatFirstPublished を entry-date.ts に足す"
Task: "T004 LinkMeta に firstPublishedOn / reposted / needsChild を足す"
```

## Implementation Strategy

1. Phase 1 でデモを作り、承認をもらう (UI の形をここで確定させ、後で直さない)
2. Phase 2 で移行し、今の機能が変わらないことを e2e で確かめる
3. Phase 3 (US1) で再掲載を保存できるようにする → MVP
4. Phase 4 (US2) で印を出す
5. Phase 5 (US3) で子のない再掲載を断り分ける
6. Phase 6 でルール・ADR・完了判定
