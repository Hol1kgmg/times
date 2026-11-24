---

description: "Task list for Digest のタイムライン画面 (009-timeline-page)"
---

# Tasks: Digest のタイムライン画面

**Input**: Design documents from `/specs/009-timeline-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: research.md R6 に従い、Vitest 1 ファイル (`prependPage` に 2 件) と、`digest-new.spec.ts` への追記 1 つだけ。自動読み込み・位置の保持・再試行は quickstart の手動確認。

**Organization**: US1 (表示) が画面の土台で、US2 (読み足し) と US3 (失敗と再試行) は同じ `timeline-page.tsx` に足していく。US4 (未ログイン) は US1 のルートとサイドバーに含まれ、そのフェーズは確認とルール文書だけ。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列可 (別ファイルで、未完了タスクに依存しない)
- **[Story]**: US1 / US2 / US3 / US4

## Path Conventions

- frontend: `frontend/src/`、e2e: `frontend/e2e/`
- backend・OpenAPI・migration の変更はない

---

## Phase 1: Setup

新しい依存・環境変数・生成物はないので、このフェーズのタスクはない。

---

## Phase 2: Foundational

**Purpose**: 画面が依存するプレビュー取得とページの足し方を先に用意する。

- [X] T001 [P] `frontend/src/pages/digest-editor/api/fetch-draft-preview.ts` を `frontend/src/shared/api/fetch-any-link-preview.ts` に移し、export 名を `fetchAnyLinkPreview` にする。中身 (`requireAdminToken()` + `loadLinkPreviewCached`) とコメントは変えないが、コメントの「トップの getLinkPreview は digest 内の URL に限っている」はそのまま残す。`load-draft-preview.ts` も `frontend/src/shared/api/load-any-link-preview.ts` (`loadAnyLinkPreview = memoLinkPreview(fetchAnyLinkPreview)`) に移す。`frontend/src/shared/api/index.ts` に 2 つを export し、`frontend/src/pages/digest-editor/ui/url-add-form.tsx` (`useServerFn(fetchAnyLinkPreview)`)・`draft-card.tsx`・`preview-dialog.tsx` の import を `#/shared/api` に替え、元の 2 ファイルを消す (research R5)
- [X] T002 [P] `frontend/src/pages/digest-timeline/model/timeline.ts` に `PAGE_SIZE = 7` と `prependPage(current: Digest[], page: Digest[]): { digests: Digest[]; done: boolean }` を書く。`page` は新しい順で届くので逆順にして `current` の前に足し、`done` は `page.length < PAGE_SIZE` (data-model.md)。`[...page].reverse()` で入力を壊さない
- [X] T003 [P] `frontend/src/pages/digest-timeline/model/timeline.test.ts` に 2 件: 「7 件のページは古い順にして前に足し、続きがあるとする」「7 件未満のページで終わりにする」。テスト名は仕様の言葉で書く (quality.md)
- [X] T004 [P] `frontend/src/pages/digest-timeline/api/resolve-timeline-page.ts` に `resolveTimelinePage` を書く。`frontend/src/pages/digest-editor/api/resolve-digest-editor-page.ts` と同じ形 (`createServerFn({ method: "GET" })`、`currentAdmin()` が無ければ `throw notFound()`、`{ user }` を返す)。同じ理由のコメント (requireAdminPage を server function 内から呼ぶと本番ビルドで壊れる) も 1 行写す (research R1)
  > **Superseded** (#220): `resolveTimelinePage` は消した。今は `timeline.tsx` の `beforeLoad` が `requireAdminViewer(context.viewer)` を呼ぶ (research R1 の注記)。T005 の export と T007 の `beforeLoad` も同じ。

**Checkpoint**: `just fe-typecheck` と `just test` が通り、編集画面のプレビューが移動前と同じに取れる。

---

## Phase 3: User Story 1 - 直近の Digest をチャットログとして読む (Priority: P1) 🎯 MVP

**Goal**: `#timeline` から開くと、公開の Digest が古い順に並び、最下段が見えている。

**Independent Test**: quickstart.md 2・3・4・10。

- [X] T005 [US1] `frontend/src/pages/digest-timeline/ui/timeline-page.tsx` を書く。`getRouteApi("/_shell/timeline")` の `useLoaderData()` を `prependPage([], page)` に通して `useState` の初期値にする (`digests` / `done`)。0 件なら `<p>まだ記事がないです</p>`、あれば `digests.map((d) => <section key={d.id} aria-label={dateFormat.format(new Date(d.entryDate))}><DigestPost digest={d} loadPreview={loadAnyLinkPreview} /></section>)` を上から並べる (`dateFormat` は `#/shared/ui/digest-post` の既存 export)。初回だけ `useLayoutEffect` で `window.scrollTo(0, document.documentElement.scrollHeight)` (research R4)。`frontend/src/pages/digest-timeline/index.ts` で `TimelinePage` と `resolveTimelinePage` を export する
- [X] T006 [P] [US1] `frontend/src/pages/digest-timeline/ui/timeline-page.module.css` を書く。`.page` は `digest-list-page.module.css` の `.page` と同じ余白 (`padding: var(--space-4)`、`gap: var(--space-4)` の縦の flex) に `font-family: var(--font-dynamic)` を足す (UI ルール: トップ以外の画面)。`.empty` は `composes: t-body from global` + `--color-text-muted`。生の値は書かない
- [X] T007 [US1] `frontend/src/app/routes/_shell/timeline.tsx` を足す。`createFileRoute("/_shell/timeline")({ beforeLoad: async () => await resolveTimelinePage(), loader: async () => await listPublishedDigests({ data: { limit: PAGE_SIZE } }), head: () => ({ meta: [{ title: "#timeline | z_times.dev" }] }), component: TimelinePage })`。`PAGE_SIZE` も `#/pages/digest-timeline` から export する。`title` の形は既存のルートの `head` に合わせる (無ければ `title` だけ)。`just fe-dev` 起動中なら `routeTree.gen.ts` が再生成されることを確かめる
- [X] T008 [US1] `frontend/src/app/layout/sidebar.tsx` の `ChannelNav` で、`#general` の `HoverLink` の直後に `{viewer.kind === "admin" && (<HoverLink className={styles.link} to="/timeline" onClick={onNavigate}><span className={styles.hash}>#</span>timeline</HoverLink>)}` を足す (FR-002)。既存の `AdminTabs` の条件と分けて書くか 1 つの `<>` にまとめるかは、差分の小さい方にする
- [X] T009 [US1] quickstart.md 2 を手で確かめ、サイドバーから開いたときに router の `scrollRestoration` で先頭に戻されるなら、T008 のリンクに `resetScroll={false}` を付ける (research R4)。3 (再読み込み) でも最下段になることを確かめる
- [X] T010 [US1] `frontend/e2e/digest-new.spec.ts` の、トップの確認の後・「登録した日を今日にして開き直す」の前に追記する。サイドバーの `link "timeline"` を押して `/timeline` を待ち、`main` 内の `time` 要素の `dateTime` を全部取って昇順に並んでいること、最後が登録した `date` であること、その投稿の見出しの `section` が `toBeInViewport()` であることを確かめる。テスト名にも「タイムラインの最下段に出て」を足す (research R6)

**Checkpoint**: ログインして `#timeline` を開くと、最新が最下段に見えている。ここで止めても直近 7 件は読める。

---

## Phase 4: User Story 2 - 上へさかのぼると自動で古い Digest が足される (Priority: P1)

**Goal**: 上端までスクロールすると次の 7 件が上に足され、見ていた位置は動かない。

**Independent Test**: quickstart.md 5・6・7。

- [X] T011 [US2] `timeline-page.tsx` に `status: "idle" | "loading" | "error"` の state と `loadOlder` を足す。`loadOlder` は `status` を `"loading"` にし、`useServerFn(listPublishedDigests)` で `{ data: { before: digests[0].entryDate, limit: PAGE_SIZE } }` を呼ぶ。成功したら ref に `document.documentElement.scrollHeight - window.scrollY` を取ってから `prependPage(digests, page.digests)` で `digests` / `done` を更新し `status` を `"idle"` に戻す。`useLayoutEffect` (deps: `digests`) で ref があれば `window.scrollTo(0, document.documentElement.scrollHeight - ref)` にして ref を消す (research R3、FR-006)。Safari が `overflow-anchor` 未対応である理由をコメント 1 行で残す
- [X] T012 [US2] 投稿の列の上に状態表示の行 (`<div ref={edgeRef} className={styles.edge} role="status">`) を置き、`useEffect` (deps: `status`, `done`, `digests`) で `status === "idle" && !done && digests.length > 0` のときだけ `new IntersectionObserver(([e]) => { if (e?.isIntersecting) loadOlder(); })` を作って `edgeRef` を見張り、cleanup で `disconnect()` する。読み込みのたびに作り直すことで、中身が画面より短ければ続けて読む (research R2、FR-007・FR-008)。この理由をコメント 1 行で残す。`loading` のときは行に「読み込み中」を出す。初回の最下段へのスクロール (T005 の layout effect) より後に見張りが始まることを確かめる。`// ponytail: 全件を DOM に積む。数百件で重くなったら仮想化する` を残す
- [X] T013 [P] [US2] `timeline-page.module.css` に `.edge` を足す。`display: flex; align-items: center; justify-content: center;`、高さは再試行ボタンが入る分を普段から取る (`min-height` はボタンと同じトークンの組み合わせで出す。生の値が要るならボタンを常に置いて `visibility: hidden` にする方を選ぶ)。文字は `composes: t-meta from global` + `--color-text-muted` (UI ルール: 押す対象を動かさない)

**Checkpoint**: 上へスクロールし続けるだけで最初の Digest までたどれ、位置が飛ばない。

---

## Phase 5: User Story 3 - 読み込みに失敗したらやり直せる (Priority: P2)

**Goal**: 失敗したら「読み込めませんでした」と再試行ボタンを出し、自動ではやり直さない。

**Independent Test**: quickstart.md 8・9。

- [X] T014 [US3] `loadOlder` の失敗 (`catch`) で `status` を `"error"` にし、`digests` は変えない。状態表示の行に `error` のとき「読み込めませんでした」と `<HoverButton type="button" onClick={loadOlder}>再試行</HoverButton>` を出す。T012 の見張りは `idle` のときだけなので、失敗中は自動で読み込まない (FR-009)
- [X] T015 [P] [US3] `timeline-page.module.css` に再試行ボタンの `.retry` を足す。UI ルールのボタンの型 (`--color-surface-raised` の地 + `--color-border` の線 + `--radius-control` + `--shadow-menu`、文字は `.t-body` の `--color-text`、ホバーは `[data-hovered]`、`:active` の小さな拡大と `prefers-reduced-motion` で止める指定)。既存のボタンの CSS (例: `pages/digest-editor/ui/*.module.css`) に同じ型があれば写す

**Checkpoint**: 通信を止めても投稿は消えず、戻して再試行を押せば続きが足される。

---

## Phase 6: User Story 4 - ログインしていない人には出さない (Priority: P1)

**Goal**: 未ログインにはタブも画面も出さない。実装は T004・T007・T008 で済んでいる。

**Independent Test**: quickstart.md 1。

- [X] T016 [US4] quickstart.md 1 を確かめる (ログアウト状態でサイドバーに `#timeline` がなく、`/timeline` が見つからない画面になる)
- [X] T017 [P] [US4] `rules/frontend-ui-design.md` のシェルの節「サイドバーとモバイルヘッダーは全員に出す。…」の行に、ログイン中は `#general` の下にタイムライン (`#timeline`) も出すことを書き足す。`.agents/rules/` は Nix 生成なので直接書かない (rules.nix の再生成で反映)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T018 quickstart.md 4・11 を確かめる (タイムラインの古い日の記事でプレビューが出る、編集画面のプレビューが移動後も取れる)
- [X] T019 quality.md「完了の判定」を通す: `just lint && just test`、`just fe-typecheck`、`just fe-test-e2e digest-new` (手順 1〜4 のとおり backend を e2e 用に切り替え、終わったら戻す)。落ちたら出力を添えて報告する
- [X] T020 [P] `TODO.md` の「過去 Digest のタイムライン画面」に、specs/009 で画面ができたことを `[x]` と日付で書き、残り (トップの `#general` 見出しをタイムラインへの扉にする) を書き足す (TODO.md はコミットしない)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2**: T001〜T004 は互いに独立 (並列可)
- **Phase 3**: T005 (T001・T002・T004 の後) → T007 (T005 の後) → T008 → T009 → T010。T006 は T005 と並列
- **Phase 4**: T011 → T012 (同じファイル)。T013 は並列
- **Phase 5**: T014 (T012 の後)。T015 は並列
- **Phase 6**: T016 は T008 の後。T017 はいつでも
- **Phase 7**: すべての後

### User Story Dependencies

- US2・US3 は US1 の `timeline-page.tsx` に足すので US1 の後。US3 は US2 の `status` と見張りに依存
- US4 は US1 のルートとサイドバーで実装済みになる

### Parallel Opportunities

- T001・T002・T003・T004 (別ファイル)
- T005 と T006、T012 と T013、T014 と T015 (tsx と css)
- T017・T020 (文書)

## Parallel Example: Phase 2

```text
Task: "T001 プレビュー取得を shared/api に移して改名"
Task: "T002 model/timeline.ts の prependPage"
Task: "T003 model/timeline.test.ts"
Task: "T004 api/resolve-timeline-page.ts"
```

## Implementation Strategy

### MVP First (US1 + US4)

1. Phase 2 → Phase 3 で、ログインユーザーが直近 7 件を最下段から読める
2. T016 で未ログインに出ないことを確かめる
3. ここで止めても、トップより多くの日を読める

### Incremental Delivery

1. Phase 4 (US2) で自動の読み足しを足す
2. Phase 5 (US3) で失敗からの回復を足す
3. Phase 7 で完了の判定を通す
