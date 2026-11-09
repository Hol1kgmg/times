---

description: "Task list for 013-article-click-tracking"
---

# Tasks: 記事リンクのクリック数を記事ごとに数える

**Input**: Design documents from `/specs/013-article-click-tracking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/article-open.md, quickstart.md

**Tests**: constitution 原則 V と `.agents/rules/quality.md` に従う。受付の分岐 (本文の検証・bot・端末・URL の切り詰め) は Vitest、UI と受付のつながりは既存の `digest-new` e2e に 1 手順足す。プレビューから送れないことは型で押さえ、テストは書かない。モックは `fetch` (GA4) だけ。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで依存がなく、並行してできる
- **[Story]**: 対応する User Story (US1〜US4)
- パスはリポジトリのルートからの相対

---

## Phase 1: Setup

- [X] T001 (2026-11-10 済み) 管理者に GA4 のコンソールで、(1) 対象の web ストリームに Measurement Protocol API secret を作る、(2) イベントスコープのカスタムディメンション `article_id` / `article_url` / `digest_date` を登録する、(3) Cloudflare のダッシュボードで Worker `times` に Variable `GA_MEASUREMENT_ID` と Secret `GA_API_SECRET` を入れる、を頼む (quickstart.md「事前準備」)。登録より前のイベントは集計されないので、デプロイの前に済ませる。CLI で GA4・Cloudflare を変更しない。secret は会話にもファイルにも残さない

---

## Phase 2: Foundational

- [X] T002 `frontend/src/shared/api/cloudflare-workers.d.ts` の `declare module "cloudflare:workers"` に `export const waitUntil: (promise: Promise<unknown>) => void;` を足す (research R4)

**Checkpoint**: `just fe-typecheck` が通る

---

## Phase 3: User Story 1 - 読み手が記事リンクを押すと 1 回として数えられる (Priority: P1) 🎯 MVP

**Goal**: トップ・タイムラインの記事リンクのクリック・タップ・中クリックで、`POST /open` を経て GA4 に `article_click` が 1 件届く

**Independent Test**: トップで記事を押すと `/open` に記事の id・URL・日付が送られ、204 が返る (e2e)。デプロイ後は GA4 の DebugView に届く (quickstart.md)

- [X] T003 [US1] `frontend/src/shared/api/article-open.server.ts` を作る。
  - `export const articleOpen = z.object({ articleId, url: z.url(), entryDate: z.iso.date() })` (`articleId` は `schemas.ts` のブランド型)。
  - `export const toMeasurementPayload = (open: ArticleOpen, userAgent: string, ip: string | null)` は、UA が `/bot|crawl|spider|headless/i` に当たれば `null` を返す (`// ponytail: UA の正規表現だけ。JS を実行する bot が増えたら isbot などに替える`)。当たらなければ `{ client_id: crypto.randomUUID(), ip_override: ip (null なら項目ごと付けない), device: { category }, events: [{ name: "article_click", params: { article_id, article_url: url.slice(0, 100), digest_date: entryDate } }] }` を返す。
  - `category` は UA が `/iPad|Tablet/i` なら `"tablet"`、`/Mobi|Android/i` なら `"mobile"`、それ以外は `"desktop"` (research R1)。
  - `export const handleArticleOpen = async (request: Request): Promise<Response>` は、本文を `request.json()` で読んで `articleOpen.safeParse` に通す。JSON でない・不正なら 400。`process.env.GA_MEASUREMENT_ID` / `GA_API_SECRET` のどちらかが空、または payload が `null` なら 204 で終わる。それ以外は `fetch("https://www.google-analytics.com/mp/collect?measurement_id=…&api_secret=…", { method: "POST", body: JSON.stringify(payload) })` を `waitUntil` に渡し、204 を返す。
  - `waitUntil` は `workers-ai.server.ts` と同じく `await import("cloudflare:workers")` で取り、import に失敗したら送らない。送信の失敗は `console.error` だけで再送しない (contracts/article-open.md)
- [X] T004 [US1] `frontend/src/shared/api/article-open.server.test.ts` に Vitest を書く。`it("drops a request from a bot user agent")`、`it("classifies a mobile user agent as mobile")`、`it("cuts article_url to the 100 characters GA4 accepts")`、`it("rejects a body whose entryDate is not a date")` (`articleOpen.safeParse` の失敗)
- [X] T005 [US1] `frontend/src/app/routes/open.ts` を作る。`feed[.]xml.ts` と同じ形で `createFileRoute("/open")({ server: { handlers: { POST: ({ request }) => handleArticleOpen(request) } } })`。`just fe-gen` 相当の routeTree の再生成が要れば `frontend/src/app/routeTree.gen.ts` の差分も含める
- [X] T006 [P] [US1] `frontend/src/shared/api/report-article-open.ts` を作る。`export const reportArticleOpen = (entryDate: string) => (article: { id: ArticleId; url: string }) => { void fetch("/open", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ articleId: article.id, url: article.url, entryDate }) }).catch(() => {}); }`。catch には「計測の失敗は読み手に関係なく、再送もしない (spec FR-003)」の 1 行コメント。`frontend/src/shared/api/index.ts` から export する
- [X] T007 [US1] `frontend/src/shared/ui/digest-post.tsx` を変える。
  - props を `{ digest: Digest; onOpen?: (article: { id: ArticleId; url: string }) => void; loadPreview; action? } | { digest: DigestContent; onOpen?: never; loadPreview; action? }` の合併にする (research R7)。
  - `Entry` と `ArticleLink` に `onOpen?: () => void` を渡す。記事ごとの束縛は `DigestPost` の中で、`"id" in article` で id を持つ記事にだけ作る (`Digest` の記事は親子とも `id` を持つ)。
  - `ArticleLink` の `<Link>` に `onPress={onOpen}` と `onAuxClick={(e) => { if (e.button === 1) onOpen?.(); }}` を足す。`auxclick` は右クリックでも来るので中ボタンに絞る、の 1 行コメント (research R5)。`href` は `article.url` のまま
- [X] T008 [P] [US1] `frontend/src/pages/home/ui/digest-card.tsx` の `<DigestPost>` に `onOpen={reportArticleOpen(digest.entryDate)}` を渡す
- [X] T009 [P] [US1] `frontend/src/pages/digest-timeline/ui/timeline-page.tsx` の `<DigestPost>` に `onOpen={reportArticleOpen(d.entryDate)}` を渡す
- [X] T010 [US1] `frontend/e2e/digest-new.spec.ts` のトップの確認 (`links` の `toHaveText` の後) に 1 手順足す。`const opened = page.waitForRequest((r) => r.url().endsWith("/open") && r.method() === "POST")` を待ち受けてから `links.first()` をクリックし、`(await opened).postDataJSON()` が `{ url: <security の記事の URL>, entryDate: date }` を含み、`articleId` が uuid であることを確かめる。新しいタブ (`popup`) は開いたら閉じる。テスト名に「記事を押すと開いた記録が送られ」を足す

**Checkpoint**: `just test`、`just fe-typecheck`、`just fe-test-e2e digest-new` が通る

---

## Phase 4: User Story 2 - 記事の URL をそのままコピーできる (Priority: P1)

**Goal**: 記事リンクの `href` が記事の元の URL のまま

**Independent Test**: T010 の e2e で `links.first()` の `href` が記事の URL と一致する

- [X] T011 [US2] `frontend/e2e/digest-new.spec.ts` の T010 の手順に `await expect(links.first()).toHaveAttribute("href", <security の記事の URL>)` を足す (中継の URL に置き換わっていないこと)

---

## Phase 5: User Story 3 - 管理者が記事ごとのクリック数を見る (Priority: P1)

**Goal**: GA4 の探索で記事ごとのクリック数が出る

**Independent Test**: デプロイ後、quickstart.md の「記事ごとの回数」と「端末」の確認

- [ ] T012 [US3] デプロイ後に管理者と quickstart.md「デプロイ後の確認」の表を上から確かめる。`デバイス カテゴリ` が分かれなければ (research R1 の未確定)、`frontend/src/shared/api/article-open.server.ts` から `device` と端末の分類、そのテストを外す

---

## Phase 6: User Story 4 - 編集のプレビューは数えない (Priority: P2)

**Goal**: プレビューから記録が送られない

**Independent Test**: `preview-dialog.tsx` に `onOpen` を渡すと型エラーになる

- [X] T013 [US4] `frontend/src/pages/digest-editor/ui/preview-dialog.tsx` が `onOpen` を渡していないことと、`DigestContent` の `digest` に `onOpen` を足すと `just fe-typecheck` が落ちることを確かめる (確かめた後は戻す。コードは変えない)

---

## Phase 7: Polish

- [X] T014 [P] `docs/tech-stack.md` の frontend の環境変数の一覧に `GA_MEASUREMENT_ID`、シークレット `GA_API_SECRET` (specs/013) を足す
- [X] T015 `.agents/rules/quality.md` の「完了の判定」を通す: `just lint && just test`、`just fe-typecheck`、`just fe-test-e2e digest-new` (backend を `be-dev-e2e` に切り替える手順に従う)

---

## Dependencies

- T001 はデプロイ前までに済めばよく、実装を止めない
- T002 → T003 → T004 / T005
- T006 → T007 → T008 / T009 → T010 → T011
- T005 と T010 は両方そろって e2e が通る
- US2 は US1 の e2e に乗る。US3 はデプロイ後。US4 は T007 の型だけで満たされる

## Parallel Example: User Story 1

```text
T003 (受付) と T006 (ブラウザの送信) は別ファイルで並行できる
T008 (トップ) と T009 (タイムライン) は T007 の後に並行できる
```

## Implementation Strategy

1. MVP: Phase 2 → Phase 3 (US1)。e2e が通ればトップ・タイムラインのクリックが受付に届く
2. US2・US4 は US1 の e2e と型で確かめるだけ
3. T001 を済ませてデプロイし、US3 (GA4 の画面) を確かめる
