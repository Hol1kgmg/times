---

description: "Task list for 014-anonymous-analytics"
---

# Tasks: 匿名 ID で記事別 UU・サイト UU・DAU・MAU を数える

**Input**: Design documents from `/specs/014-anonymous-analytics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/open.md, quickstart.md

**Tests**: constitution 原則 V と `.agents/rules/quality.md` に従う。匿名 ID の分岐 (保存済み・壊れた値・保存できない) と受付の分岐 (合併・UUID・4 KB・クエリ落とし) は Vitest。ブラウザ → 受付のつながりは既存の `digest-new` e2e の手順を広げる (新しい spec は作らない)。`page_view` の許可リストと重複の抑止は e2e と手の確認で押さえ、部品のテストは書かない (テストのための export をしない)。モックは `fetch` と `localStorage` (外部 I/O) だけ。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで依存がなく、並行してできる
- **[Story]**: 対応する User Story (US1〜US4)
- パスはリポジトリのルートからの相対

---

## Phase 1: Setup

- [X] T001 (2026-11-10 済み: 保持期間を 14 か月に変更、タイムゾーンは日本。`docs/analytics.md` に反映) 管理者に GA4 のコンソールで quickstart.md「事前準備」1〜5 を頼む: レポート用識別子を「デバイスベース」、Google シグナルが無効か、データ保持期間 (2 か月 / 14 か月) とタイムゾーンを確かめて教えてもらう、specs/013 のカスタム ディメンションが登録済みか。CLI で GA4 を変更しない。結果は T014 で `docs/analytics.md` に書く

---

## Phase 2: Foundational

- [X] T002 ファイル名を改める (`git mv`): `frontend/src/shared/api/article-open.server.ts` → `open.server.ts`、`article-open.server.test.ts` → `open.server.test.ts`、`report-article-open.ts` → `report.ts`。`handleArticleOpen` を `handleOpen` に改名し、`frontend/src/app/routes/open.ts` と `frontend/src/shared/api/index.ts` (`export { reportArticleOpen, reportPageView } from "./report";` は T007 で揃える) の import を直す。振る舞いはまだ変えない

**Checkpoint**: `just fe-typecheck` と `just test` が通る

---

## Phase 3: User Story 1 - 同じブラウザの読み手を 1 人として数える (Priority: P1) 🎯 MVP

**Goal**: 記事のクリックが、同じブラウザでは同じ匿名 ID を `client_id` にして GA4 に届く

**Independent Test**: Vitest で匿名 ID の再利用・作り直し・メモリへの切り替え、受付の `clientId` の検証と `client_id` への転送を確かめる。e2e で `/open` の本文に UUID の `clientId` が入る

- [X] T003 [P] [US1] `frontend/src/shared/lib/anonymous-id.ts` を作る。`export const anonymousId = (): string`。localStorage のキー `times.cid` を読み、`z.uuid().safeParse` に通ればそれを返す。通らない (なし・壊れた値) なら `crypto.randomUUID()` を作って保存して返す。`getItem` / `setItem` の例外は握りつぶしてモジュール変数の ID を使う (コメント 1 行: 保存を止めたブラウザではページの中だけで使い回す)。2 回目以降の呼び出しもモジュール変数を先に見て、ページの中で値がぶれないようにする。ブランド型は付けない (ブラウザの中だけで使い、受付が `z.uuid()` で検証する)
- [X] T004 [P] [US1] `frontend/src/shared/lib/anonymous-id.test.ts` を作る (vitest の `vi.stubGlobal("localStorage", …)` で外部 I/O だけを差し替え、テストごとに `vi.resetModules()` してから動的 import でモジュール変数を初期化する)。3 件: `it("reuses the id already saved in this browser")`、`it("replaces a saved value that is not a UUID")`、`it("keeps one id within the page when storage throws")`
- [X] T005 [US1] `frontend/src/shared/api/open.server.ts` の本文を `z.discriminatedUnion("event", [...])` にする。共通に `clientId: z.uuid()`、`article_click` は既存の `articleId` / `url: z.url()` / `entryDate: z.iso.date()`。本文は `await request.text()` で読み、4096 文字を超えたら 400 (JSON の解析の前)。GA4 の payload の `client_id` を `crypto.randomUUID()` から `parsed.data.clientId` に替え、`article_click` の params に `engagement_time_msec: 1` を足す (research R4)。`page_view` の分岐は T010 で足すので、この時点では `article_click` だけの合併でよい
- [X] T006 [US1] `frontend/src/shared/api/open.server.test.ts` を直す。既存 4 件の `valid` に `event: "article_click"` と `clientId` (UUID) を足す。2 件足す: `it("forwards the browser's anonymous id as the GA4 client id")` (送った `clientId` が GA4 の本文の `client_id` と一致)、`it("rejects a clientId that is not a UUID")` (400 で fetch しない)。`sent` スキーマに `client_id: z.string()` を足す
- [X] T007 [US1] `frontend/src/shared/api/report.ts` に共通の `post = (body: object) => fetch("/open", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, clientId: anonymousId() }) }).catch(() => {})` を置き、`reportArticleOpen` は `{ event: "article_click", articleId, url, entryDate }` を `post` する。既存の 2 つのコメント (sendBeacon を使わない理由、失敗を無視する理由) は残す。`anonymousId` は `#/shared/lib/anonymous-id` から import
- [X] T008 [US1] `frontend/e2e/digest-new.spec.ts` の記事を押す手順の期待を `{ event: "article_click", clientId: expect.stringMatching(/^[\da-f-]{36}$/u), articleId: …, url: securityUrl, entryDate: date }` にする

**Checkpoint**: `just test`、`just fe-typecheck` が通る。US1 だけでデプロイしても、記事別 UU が出る

---

## Phase 4: User Story 2 - 記事を押さずに見ただけの読み手も数える (Priority: P1)

**Goal**: 公開画面を開く・移るたびに `page_view` が 1 件、記事のクリックと同じ匿名 ID で届く。管理画面とログイン画面からは送らない

**Independent Test**: e2e でトップを開くと `page_view` が飛び、同じページで押した記事の `article_click` と `clientId` が一致する。quickstart.md「ローカルの確認」の表を手で確かめる

- [X] T009 [P] [US2] `frontend/src/shared/api/report.ts` に `export const reportPageView = () => post({ event: "page_view", location: location.origin + location.pathname, title: document.title })` を足し、`frontend/src/shared/api/index.ts` の export に加える
- [X] T010 [US2] `frontend/src/shared/api/open.server.ts` の合併に `page_view` を足す: `location: z.url()`、`title: z.string()`。GA4 のイベントは `{ name: "page_view", params: { page_location, page_title, engagement_time_msec: 1 } }`。`page_location` は `new URL(location)` の `search` と `hash` を空にしてから 1000 文字で切る (コメント 1 行: 受付が信頼境界なのでブラウザで落としていても落とす)、`page_title` は 300 文字で切る。`ip_override` と `device.category`、bot と測定 ID の判定は 2 つのイベントで共通に使う
- [X] T011 [US2] `frontend/src/shared/api/open.server.test.ts` に 2 件足す: `it("drops the query string and fragment from page_location")`、`it("rejects an event name outside article_click and page_view")`
- [X] T012 [US2] `frontend/src/app/routes/__root.tsx` に部品 `PageView` を書き、`<Outlet />` の隣に置く。`useRouterState({ select: (s) => s.matches.at(-1) })` から `routeId` と `pathname` を取り、`useEffect` の中で、モジュール変数 `lastPath` と pathname が同じなら何もせず、違えば `lastPath` を更新し (公開画面でなくても更新する。トップ → 管理画面 → トップで戻った分を数えるため)、routeId が `PUBLIC_ROUTES = new Set(["/", "/_shell/timeline", "/digest/$date"])` に入るときだけ `reportPageView()` を呼ぶ (research R2)。コメントは 2 つ、1 行ずつ: 許可リストにする理由 (ログイン画面の秘密のパスを GA4 に載せない)、モジュール変数にする理由 (Strict Mode の effect の二重実行と同じ URL への移動で数を増やさない)。routeId の文字列は `FileRoutesById` の型で縛る (`satisfies` か型引数)。`reportPageView` は `#/shared/api` から import する
- [X] T013 [US2] `frontend/e2e/digest-new.spec.ts` で、トップへの `page.goto` の前に `page.waitForRequest` を `/open` の POST かつ `postDataJSON().event === "page_view"` に絞って仕掛け、届いた本文の `location` がトップの URL (クエリなし) であることと、その `clientId` が T008 の `article_click` の `clientId` と一致することを確かめる。新しい e2e の spec は作らない

**Checkpoint**: `just test`、`just fe-typecheck`、`just fe-test-e2e digest-new` が通る。quickstart.md「ローカルの確認」の表 (初回 1 件・遷移・管理画面・クエリ・保存できない) を `just fe-dev` で手で確かめる

---

## Phase 5: User Story 3 - 管理者が記事別 UU・サイト UU・DAU・MAU を確かめる (Priority: P1)

**Goal**: `docs/analytics.md` を読めば、GA4 で各指標を出せて、読むときの注意と代わりの方法が分かる

**Independent Test**: デプロイ後に quickstart.md「デプロイ後の実測」を行い、結果が `docs/analytics.md` に書かれている

- [X] T014 [US3] `docs/analytics.md` を作る。節: 指標の定義 (data-model.md「指標」の表。MAU は暦の月ではなく過去 30 日、記事別 UU を足してもサイト UU にならない、匿名 ID はブラウザ単位で実人数ではない)、送っているイベント (data-model.md の GA4 の表、受付 `POST /open` の役割)、GA4 での出し方 (research R5 の探索の設定)、「総ユーザー数」と「アクティブユーザー数」の違いと、標準の 28 日の指標を使わない理由 (R4・R5)、前提の設定 (T001 の結果: レポート用識別子・シグナル・保持期間・タイムゾーン)、制約 (R6: 日付の境目、保持期間、bot、欠測、Safari の ITP による水増し)、代わりの方法と選ぶ条件 (R7)、実測の結果 (空欄で置き、T018 で埋める)
- [X] T015 [P] [US3] `docs/tech-stack.md` の GA4 の記述 (specs/013 で足した `GA_MEASUREMENT_ID` / `GA_API_SECRET` のあたり) から `docs/analytics.md` へリンクする

**Checkpoint**: `docs/analytics.md` に spec US3 の受け入れシナリオ 4・5 の項目がすべてある

---

## Phase 6: User Story 4 - 読み手が計測されていることと消し方を知る (Priority: P2)

**Goal**: トップの FAQ に「何か記録してる？」がある

**Independent Test**: トップの FAQ を開いて、何を数えるか・何を保存するか・どう消すかが 1 問で読める

- [X] T016 [P] [US4] `frontend/src/pages/home/ui/about.tsx` の `faqs` の「どのくらい更新される？」の後ろ、「誰がやってる？」の前に `{ q: "何か記録してる？", a: "…" }` を足す。話し言葉で、Google アナリティクスで閲覧数と記事が押された数を数えていること、そのためにブラウザに匿名の ID を保存していること (名前やログインとは結び付けていない)、ブラウザでこのサイトのデータを消すと ID も消えることの 3 つを書く。例: 「Google アナリティクスで、ページが見られた数と記事が押された数を数えてます。同じブラウザを見分けるために、ランダムな ID をブラウザに保存してます (名前やログインとは結び付けてません)。ブラウザの設定でこのサイトのデータを消すと、ID も消えます。」
- [X] T017 [P] [US4] `rules/frontend-ui-design.md` のトップページの節、「FAQ はヒーローで言っていないこと (見方・過去分・更新頻度・運営者) に答え」を「(見方・過去分・更新頻度・計測・運営者)」にする。`.agents/rules/frontend-ui-design.md` は直接書かず、`rules.nix` の同期の手順 (rules/README.md) で反映する

**Checkpoint**: `just fe-typecheck` が通る

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T018 デプロイ後、管理者に quickstart.md「デプロイ後の実測」1〜4 を頼み、結果 (イベント数・総ユーザー数・その日の総ユーザー数・アクティブユーザー数・デバイス カテゴリ) を `docs/analytics.md` の「実測の結果」に書く。合わなければ、合わなかった点と research R7 のどれを次に試すかを書く
- [X] T019 完了の判定 (`.agents/rules/quality.md`): `just lint && just test`、`just fe-typecheck`、`just fe-test-e2e digest-new` (backend を `be-dev-e2e` に切り替える手順で)。落ちたら出力を添えて報告する

---

## Dependencies & Execution Order

- Setup (T001) は GA4 のコンソールの確認で、コードの作業を止めない。結果は T014 で使う
- Foundational (T002) → US1 (T003〜T008) → US2 (T009〜T013)。US2 は US1 の匿名 ID と `post` に乗る
- US3 (T014・T015) は T001 の結果があれば US1・US2 と並行して書ける。T018 はデプロイ後
- US4 (T016・T017) はほかと独立

### Parallel Opportunities

- T003 と T004 (匿名 ID とそのテスト)、T005 は別ファイル
- T009 は T010 と別ファイル
- T014・T015・T016・T017 は互いに独立で、コードの作業と並行できる

## Implementation Strategy

1. T002 → US1 で MVP: 記事別 UU が出る
2. US2 で `page_view` を足し、サイト UU・DAU・MAU の元を揃える
3. US4 の FAQ は告知なので、US1 と同じデプロイに含める (匿名 ID を保存し始める前に知らせる)
4. US3 の手順書を書き、デプロイ後に実測して結果を埋める
