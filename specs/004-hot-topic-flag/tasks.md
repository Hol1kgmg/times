---

description: "Task list for ホットトピックをカテゴリから記事のフラグへ移す (004-hot-topic-flag)"
---

# Tasks: ホットトピックをカテゴリから記事のフラグへ移す

**Input**: Design documents from `/specs/004-hot-topic-flag/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, contracts/ui.md, quickstart.md

**Tests**: constitution V (受け入れシナリオ = テスト) に従い、contracts/ui.md のテスト対応表のとおりに各 Story へテストタスクを含める。DB に接続するテストは書かない。

**Organization**: Phase 2 で契約 (OpenAPI / migration / sqlc / zod) と、enum の変更で壊れる箇所を直して全体を緑に戻す。US1 (表示) と US2 (登録) は Phase 2 の後どちらからでも進められ、US3 (移行) は US1 の表示で確認する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列可 (別ファイルで、未完了タスクに依存しない)
- **[Story]**: US1 / US2 / US3
- 各タスクにファイルパスを書く

## Path Conventions

- backend: `backend/` (Go)。生成物は `backend/internal/api/gen.go`、`backend/internal/db/*.go`、`frontend/src/shared/api/openapi.gen.ts` (`just be-gen`)
- frontend: `frontend/src/` (FSD)。テストは同階層の `*.test.ts` と `frontend/e2e/`
- UI ルールの元データは `rules/` (`.agents/rules/` は Nix 生成なので直接編集しない)

---

## Phase 1: Setup

新しい依存・環境変数・設定はないので、このフェーズのタスクはない。

---

## Phase 2: Foundational (契約とスキーマ)

**Purpose**: 全 Story が依存する契約と DB スキーマ。enum から「ホットトピック」を外すと型で壊れる箇所もここで直し、Checkpoint で全体を緑に戻す。

**⚠️ CRITICAL**: T001〜T004 は同一コミットで再生成 (`just be-gen`) を伴う (constitution II)。

- [x] T001 `backend/api/openapi.yaml` を contracts/openapi.md のとおりに変える: `Category` の enum から `ホットトピック` を外して 6 値 (`セキュリティ`, `IT系`, `UI系`, `AI系`, `面白そうなツール・サービス`, `その他`) にし、`x-enum-varnames` から `CategoryHotTopic` を外し、直前のコメントを「固定 6 カテゴリ。表示順もこの順 (specs/001 FR-007、specs/004 FR-001)」にする。`Article` の `required` を `[id, category, hot, title, url, children]` にして `hot: {type: boolean, description: ホットトピックかどうか。子記事は親に従うので ChildArticle には持たない}` を足す。`NewArticle` に `hot: {type: boolean, default: false}` を足し、`required` には足さない。`ChildArticle` / `NewChildArticle` は変えない
- [x] T002 [P] `backend/db/migrations/000006_hot_topic_flag.up.sql` / `.down.sql` を data-model.md の手順で作る。up: `ALTER TABLE articles ADD COLUMN is_hot boolean NOT NULL DEFAULT false;` → `ALTER TABLE articles DROP CONSTRAINT articles_category_check;` → `UPDATE articles SET is_hot = true, category = 'その他' WHERE category = 'ホットトピック';` → `ALTER TABLE articles ADD CONSTRAINT articles_category_check CHECK (category IN ('セキュリティ', 'IT系', 'UI系', 'AI系', '面白そうなツール・サービス', 'その他'));`。down: CHECK を DROP → `UPDATE articles SET category = 'ホットトピック' WHERE is_hot;` → 7 値の CHECK (000002 と同じ並び) を ADD → `ALTER TABLE articles DROP COLUMN is_hot;`。up の先頭に理由のコメントを 1 行だけ書く (例: `-- 子の行も category と同じく親の is_hot を持つ (specs/004 research R2)`)
- [x] T003 [P] `backend/db/queries/digests.sql` の `CreateArticle` を `INSERT INTO articles (digest_id, position, category, title, url, is_hot) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;` にする
- [x] T004 `just be-gen` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/models.go` (`Article.IsHot bool`)、`backend/internal/db/digests.sql.go` (`CreateArticleParams.IsHot`)、`frontend/src/shared/api/openapi.gen.ts` の再生成をコミット対象にする。`api.Article.Hot bool` と `api.NewArticle.Hot *bool` が生えていることを確認する
- [x] T005 `backend/internal/handler/handler.go` を変える: `CreateDigest` の `insert` に `hot bool` 引数を足して `CreateArticleParams{..., IsHot: hot}` に渡し、親も子も `hot := a.Hot != nil && *a.Hot` を渡す (直前のコメントの「子は親の category を引き継ぐ」を「子は親の category と hot を引き継ぐ」にする)。`toDigest` の親の `api.Article{...}` に `Hot: r.IsHot` を足す。子の `api.ChildArticle` は変えない
- [x] T006 [P] `backend/cmd/seed/main.go` の `insert` 呼び出しを生成後の `CreateArticleParams` に合わせる (この時点では `IsHot` は渡さず false のまま。記法は US1 の T016 で足す)。`backend/db/seed.md` の「ホットトピック」見出しは T017 で書き換えるまで残してよいが、`just db-seed` は T017 まで失敗する点を承知しておく
- [x] T007 [P] `frontend/src/shared/api/schemas.ts` を変える: `category` の `z.enum` から `"ホットトピック"` を外す。`article` に `hot: z.boolean()` を足す。`newArticle` の `extend` に `hot: z.boolean().optional()` を足す。(実施: openapi-typescript は `default` 付きの項目を必須の型にするので、`.default(false)` にした)`childArticle` / `newChildArticle` は変えない
- [x] T008 [P] `frontend/src/shared/api/schemas.test.ts` の「rejects a category outside the fixed set」に `"ホットトピック"` が拒否されるケースを足す (US2-1)。既存のテストデータで `article.parse` しているものがあれば `hot: false` を足す
- [x] T009 [P] `frontend/src/pages/home/ui/about.tsx` の `categoryDetails` から `ホットトピック` を外し、`Flame` の import を消す。FAQ「どうやって見ればいい？」の `a` を contracts/ui.md の文言「記事はカテゴリごとに並んでます。いちばん上の『ホットトピック』はその日いちばん盛り上がってたもので、横のタグが本来のカテゴリです。押すと元のページが別タブで開きます。」にする (FR-008)。`frontend/src/pages/home/ui/icons/flame.tsx` を削除する (他から参照がないことを grep で確認してから)
- [x] T010 [P] テストデータの追随: `frontend/src/pages/home/model/group-by-category.test.ts` の `make` が渡すオブジェクトに `hot: false` を足し、`frontend/src/pages/home/model/digest-urls.test.ts` と `frontend/src/shared/api/schemas.test.ts` で `article` / `digest` を parse しているデータにも `hot: false` を足す

**Checkpoint**: `just be-gen` の差分がコミット対象に入っている。`just lint && just test`、`just fe-typecheck` が通る。`just db-up` で migration 000006 が流れる。

---

## Phase 3: User Story 1 - ホットトピックを本来のカテゴリと一緒に読む (Priority: P1) 🎯 MVP

**Goal**: トップの Digest の先頭に「ホットトピック」区画を出し、親の記事行に本来のカテゴリのタグを付ける。ホットの記事はカテゴリの区画に出さない。

**Independent Test**: seed (T017) を入れてトップを開き、先頭の「ホットトピック」区画の親の記事にカテゴリのタグがあり、子記事にはなく、同じ記事がカテゴリの区画に出ていないことを確認する。

### Tests for User Story 1

- [x] T011 [P] [US1] `frontend/src/pages/home/model/group-by-category.test.ts` に `it("leaves hot articles out of the category sections and drops categories left empty")` を足す: `セキュリティ` の hot 記事 1 件、`その他` の hot でない記事 1 件、`IT系` の hot 記事 1 件を渡し、結果が `[["その他", [...]]]` だけになることを検証する (US1-4, US1-6, SC-002)
- [x] T012 [P] [US1] `backend/cmd/seed/main_test.go` に、`- 🔥 [t](https://t.example)` の行が `hot: true` の記事として、`- [u](https://u.example)` が `hot: false` として読まれ、どちらも直前のカテゴリ見出しに属することを検証するテストを足す

### Implementation for User Story 1

- [x] T013 [US1] `frontend/src/pages/home/model/group-by-category.ts` の filter を `items.filter((a) => !a.hot && a.category === name)` にし、先頭のコメントに「hot の記事はホットトピックの区画に出すので除く (specs/004 FR-006)」を 1 行足す
- [x] T014 [US1] `frontend/src/pages/home/ui/digest.tsx` を contracts/ui.md のとおりに変える: `ArticleLink` に省略可能な `tag?: Category` を足し、`.preview` の Suspense の後ろに `{tag && <span className={styles.tag}>{tag}</span>}` を置く (DOM の順は `<a>` → `.preview` → タグ。`a + .preview` の隣接セレクタを壊さないため。その理由をコメントで 1 行残す)。`Entry` に `tag?: Category` を足して親の `ArticleLink` にだけ渡し、子には渡さない。`Digest` で `const hot = items.filter((a) => a.hot)` を作り、`hot.length > 0` のとき先頭に `<li className={styles.section}><h3 className={styles.label}>ホットトピック</h3><ul className={styles.list}>…<Entry article={a} tag={a.category} />…</ul></li>` を置き、続けて既存の `groupByCategory(items)` の区画を出す。区画を出す部分が重複するなら、ファイル内の小さな関数にまとめる (export しない)
- [x] T015 [US1] `frontend/src/pages/home/ui/digest.module.css` に `.tag` を足す: `composes: t-meta from global;`、`margin-left: var(--space-half);`、`padding: 0 var(--space-1);`、`border-radius: 9999px;`、`background: var(--color-fill-faint);`、`color: var(--color-text-muted);`、`white-space: nowrap;`。枠線・ホバーの色変化・`--font-dynamic` は付けない (research R6)。9999px の直前に「日付ピル (digest-card.module.css) と同じく、使う所が増えたらトークンにする」旨を 1 行で書くかは、既存の digest-card.module.css のコメント密度に合わせて判断する
- [x] T016 [US1] `backend/cmd/seed/main.go` の `linkRe` を `^( *)- (🔥 )?\[(.+)\]\((\S+)\)$` にし、`article` に `hot bool` を足して読む (グループ番号のずれに注意)。`insert` で親の `hot` を親子の両方に `IsHot` として渡す。パッケージコメントの形式説明に「`- 🔥 [title](url)` はホットトピック」を 1 行足す
- [x] T017 [US1] `backend/db/seed.md` の「ホットトピック」見出しと、その下の記事を本来のカテゴリの見出しの下へ移し、行頭を `- 🔥 [` にする (1日目の「今さら理解するウェブフォント」は `UI系`、2日目の「TanStack Start | version.1.0公開」とその子記事は `IT系`)。`just db-seed` が通ることを確認する
- [x] T018 [US1] `rules/frontend-ui-design.md` の「Digest の投稿」の節に、カテゴリのタグの型を 1〜2 行で足す: 「ホットトピックの区画では、親の記事行のタイトルの後ろに本来のカテゴリをタグで示す。`.t-meta` の muted + `--color-fill-faint` の地 + 角丸 9999px、枠線なし。日付ピル (枠線あり・`.t-label`) と見分けるため。押せないのでホバーで色を変えない。」。あわせて同節の冒頭か「トップページ」の節に、Digest の先頭にホットトピックの区画が来ることを書く。`.agents/rules/` の再生成手順 (rules.nix) に従って反映する

**Checkpoint**: `just fe-test`、`just be-test`、`just fe-typecheck` が通る。`just db-seed` 後のトップで Independent Test を満たす。

---

## Phase 4: User Story 2 - 記事をホットトピックとして登録する (Priority: P1)

**Goal**: 登録画面で行ごとに「ホット」を付けて送れる。カテゴリは 6 択。

**Independent Test**: 2 行のうち 1 行にだけ「ホット」を付けて登録し、トップでその 1 件だけがホットトピックの区画にタグ付きで出ることを確認する。

### Tests for User Story 2

- [x] T019 [P] [US2] `backend/internal/handler/handler_test.go` の `TestToDigest` を広げる: `rows` に `IsHot: true` の親とその子 (`IsHot: true`) を足し、応答 JSON で hot の親が `"hot": true`、既存の親が `"hot": false`、子の map に `hot` キーがないことを検証する (US2-2 / FR-003 は `hot` 省略 → false の経路。handler の `a.Hot != nil && *a.Hot` は 1 行なので toDigest 側で押さえる)。テスト先頭のコメント (What) に hot の受け渡しを 1 文足す
- [x] T020 [US2] `frontend/e2e/digest-new.spec.ts` の登録シナリオを広げ、テスト名を「日付・URL・タイトル・分類・ホットを登録するとトップでホットトピックが先頭に出る」にする: 3 行目 (`その他の記事 2`) を `fillRow` の後で `page.locator('[name="hot-2"]').check()` し、関連記事を 1 件付ける (`add-child-2`、`url-2-0` / `title-2-0` に `ホットの関連記事 ${run}`)。登録後、h3 が `["ホットトピック", "セキュリティ", "その他"]`、リンクが `[その他の記事 2, ホットの関連記事, セキュリティの記事, 関連記事, その他の記事]` の順であることを検証する。タグは「ホットトピック」見出しを持つ区画 (`panel.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "ホットトピック" }) })`) の中で `getByText("その他", { exact: true })` が 1 件だけ (子記事に付かない) であることを検証する。区画で絞るのは、カテゴリ見出しの「その他」と区別するため。既存の 2 行目の関連記事の検証は残す

### Implementation for User Story 2

- [x] T021 [US2] `frontend/src/pages/digest-new/ui/digest-new-page.tsx` を変える: `Row` に `hot: boolean` を足し、`emptyRow` で `hot: false` にする。「分類」の `<label>` の後ろに `<label className={styles.field}><span className={styles.label}>ホット</span><input checked={row.hot} name={`hot-${i}`} type="checkbox" onChange={(e) => { update(row.key, { hot: e.target.checked }); }} /></label>` を置く (見た目は既存の `styles` の範囲で揃え、足りなければ `digest-new-page.module.css` に最小のクラスを足す)。送信データの item に `hot` を入れ、子には入れない。子の行には checkbox を置かない (research R2)
- [x] T022 [US2] `frontend/src/pages/digest-new/api/create-digest.ts` (サーバー関数) が `newDigest` の zod で検証して backend に渡していることを確認し、`hot` が落ちずに届くことを確認する。手を入れる必要がなければ変更しない。あわせて `frontend/src/pages/home/api/get-latest-digest.ts` が `digest.parse` を通しており、`hot` が応答から落ちないことを確認する

**Checkpoint**: `just fe-typecheck` が通る。`just db-up` と `just be-dev-e2e` を起動した状態で `just fe-test-e2e` が通る。

---

## Phase 5: User Story 3 - 既存の Digest を新しい形に移す (Priority: P2)

**Goal**: 旧データのホットトピックの記事が、記事を失わずに `hot = true` + 「その他」へ移る。

**Independent Test**: quickstart.md「ローカルでの確認」の 1〜5 を通す。

- [x] T023 [US3] quickstart.md「ローカルでの確認」の 1〜3 を実行する: `main` で `just db-reset && just db-up && just db-seed` → 本ブランチで `just db-up` → トップで旧ホットトピックの記事が先頭の区画に `その他` のタグ付きで出て、記事数・並び・子記事が移行前と同じであることを確認する (SC-004)。(実施: reset せず、旧 seed が残っていたローカル DB で up を流し、タイトル・URL・並びの一致を diff で確認。トップの画面は目視していない)
- [x] T024 [US3] quickstart.md の 5 (down) を実行する: `just db-migrate down 1` が通り、`SELECT category, count(*) FROM articles GROUP BY 1` で `ホットトピック` に戻っていること、`just db-migrate up` で再び移ることを確認する。確認後に `just db-seed` で新しい seed を入れ直す
- [x] T025 [US3] 本番の移行手順 (quickstart.md「本番の移行」) を確認し、デプロイ後に管理者が同じ日付で登録し直す必要がある旨を PR の本文に書く準備をする (コード変更なし)

**Checkpoint**: 移行の up / down がローカルで往復できる。

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T026 [P] `specs/001-digest-builder/spec.md` の FR-007 を「カテゴリは固定の一覧『セキュリティ、IT系、UI系、AI系、面白そうなツール・サービス、その他』とし、この順序で表示する (MUST)。ホットトピックはカテゴリではなく記事の印として扱う (specs/004)。」に、Key Entities の「固定の 7 つ」を「固定の 6 つ」に改める
- [x] T027 [P] `specs/002-article-digest-view/spec.md` の FR-003 を 6 カテゴリの固定順に改め、「ホットトピックの印が付いた記事は、カテゴリより先の『ホットトピック』の区画に出す (specs/004 FR-005)」を足す。Key Entities の「固定の 7 つ」を「固定の 6 つ」に改める
- [x] T028 [P] `backend/db/migrations/000002_create_digests.up.sql` の CHECK とコメントは履歴なので変えないことを確認し、`git grep -n "ホットトピック"` の残りが migration 000002 / 000006 の down、specs、seed のコメント以外にないことを確かめる
- [x] T029 完了の判定 (rules/quality.md) を通す: `just be-gen` (差分なし)、`just lint && just test`、`just fe-typecheck`、`just fe-test-e2e`。落ちたら出力を添えて報告する

---

## Phase 7: 表示の見直し (2026-10-24)

**Purpose**: 専用区画 + カテゴリタグ (T011 / T013〜T015 / T018 / T020 の表示部分) をやめ、本来のカテゴリの中で炎と HOT の印で示す形に改める (spec US1 / FR-005〜007、research R5 / R6)。DB・API・登録画面・migration は変えない。

- [x] T030 [US1] `frontend/src/pages/home/model/group-by-category.ts` を HEAD に戻し (hot を除かない)、`group-by-category.test.ts` から hot のテストを外す。`make` の `hot` 引数は残す
- [x] T031 [US1] `frontend/src/pages/home/ui/icons/flame.tsx` の削除を取り消す (`git restore --staged --worktree`)
- [x] T032 [US1] `frontend/src/pages/home/ui/digest.tsx` からホットトピックの区画 (`Section`) と `tag` を外し、`ArticleLink` に `hot` を足す。`<a>` の中のタイトルの直後に `<span className={styles.hot}><Flame animate={pointed} aria-hidden size={16} /><span className={styles.hotLabel}>HOT</span></span>` を置き、`pointed` は `mouseenter` / `focus` で true、`mouseleave` / `blur` で false にする。`Entry` は親にだけ `hot={article.hot}` を渡す
- [x] T033 [US1] `frontend/src/pages/home/ui/digest.module.css` の `.tag` を外し、contracts/ui.md の「印の CSS」のとおり `.hot` / `.hotLabel` と `@media (hover: hover)` / `@media (prefers-reduced-motion: reduce)` を足す
- [x] T034 [US1] `frontend/src/pages/home/ui/about.tsx` の FAQ を「炎のアイコンが付いてるのは、その日いちばん盛り上がってたものです。」に改め、`direnv exec . just fe-font-subset` で固定文字のサブセットを作り直す
- [x] T035 [US1] `frontend/e2e/digest-new.spec.ts` を、見出しがカテゴリだけ (`["セキュリティ", "その他"]`)、リンクが登録順で hot の親が `その他の記事 2 ${run}HOT`、`HOT` を含むリンクがその 1 件だけ、の検証に改める
- [x] T036 spec / plan / research / data-model / contracts/ui.md / quickstart、`specs/002-article-digest-view/spec.md` の FR-003、`rules/frontend-ui-design.md` (`just rules` で同期) を印の表示に追随させる
- [x] T037 完了の判定: `just lint`、`just test`、`just fe-typecheck`、`just fe-test-e2e`
- [x] T038 [US1] HOT を `--color-brand` の文字 → 吹き出しの SVG (`frontend/src/pages/home/ui/icons/hot-bubble.tsx`) に改め、ホバーで `scale` で飛び出させてしっぽの先を軸に揺らす。白の文字色として `--color-on-brand` を `frontend/src/app/styles/global.css` に足し、UI ルールに地に橙を敷く例外として書く。`just fe-lint`、`just fe-typecheck`、`just fe-test`、`just fe-test-e2e` を通す
- [x] T039 [US1] タッチ端末のタップ (`mouseenter` / `focus` が来る) と動きを減らす設定で炎と吹き出しが動かないよう、`frontend/src/pages/home/ui/digest.tsx` で `matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)")` が真のときだけ `pointed` を立てる

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: 全 Story をブロックする。T001 → T004 (生成) → T005 / T006 / T007〜T010
- **US1 (Phase 3)**: Phase 2 の後。T011 → T013、T012 → T016 → T017
- **US2 (Phase 4)**: Phase 2 の後。US1 とは独立に実装できるが、T020 (e2e) のタグの検証は US1 の T014 / T015 に依存する
- **US3 (Phase 5)**: US1 の表示 (T014) と T017 (新 seed) の後
- **Polish (Phase 6)**: T026〜T028 はいつでも。T029 は最後

### Within Each User Story

- テスト (T011 / T012 / T019 / T020) を先に書き、落ちることを見てから実装する
- seed は記法 (T016) → データ (T017) の順

### Parallel Opportunities

- Phase 2: T002 と T003 は並列。T004 の後、T006〜T010 は互いに並列 (T005 は handler.go 単独)
- US1: T011 と T012 は並列。T018 (rules) は他と並列
- US2: T019 は US1 と並列に書ける
- Polish: T026〜T028 は並列

## Parallel Example: Phase 2 (T004 の後)

```text
Task: "T006 seed の CreateArticleParams 追随 (backend/cmd/seed/main.go)"
Task: "T007 schemas.ts の category / hot (frontend/src/shared/api/schemas.ts)"
Task: "T009 about.tsx と flame.tsx の削除"
Task: "T010 テストデータに hot: false"
```

## Implementation Strategy

### MVP First (US1 + US2)

US1 と US2 はどちらも P1 で、そろって初めて「登録して読める」になる。Phase 2 → US1 → US2 の順に進め、US2 の Checkpoint (e2e) を MVP の完了とする。

### Incremental Delivery

1. Phase 2: 契約と migration。この時点で本番データは「その他」のタグなしで表示される (区画はまだない)
2. US1: ホットトピックの区画とタグ。旧データは区画に `その他` のタグで出る
3. US2: 登録画面の「ホット」。本番で登録し直せるようになる
4. US3: 移行の往復確認と本番手順
5. Polish: 001 / 002 の spec の追随と完了の判定

Phase 2 単独ではホットトピックの区画が消えた状態になるので、デプロイは US2 まで終えてから行う。
