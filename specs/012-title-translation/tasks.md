---

description: "Task list for 012-title-translation"
---

# Tasks: 記事タイトルを固有名称を残して日本語に翻訳する

**Input**: Design documents from `/specs/012-title-translation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/translate-title.md, quickstart.md

**Tests**: constitution 原則 V と `.agents/rules/quality.md` に従い、分岐のあるロジックにだけ Vitest を書く。e2e は書かない (backend・DB・セッションに触れないため)。外部 I/O (clef、`fetch`) だけをモックする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで依存がなく、並行してできる
- **[Story]**: 対応する User Story (US1, US2, US3)
- パスはリポジトリのルートからの相対

---

## Phase 1: Setup

- [X] T001 管理者に、GCP のコンソールで Cloud Translation API を有効にし、Cloud Translation API だけに制限した API キーを作り、Cloudflare のダッシュボードで Worker `times` のシークレット `GOOGLE_TRANSLATE_API_KEY` に登録してもらう (quickstart.md の前提)。CLI で GCP・Cloudflare を変更しない
- [X] T002 (2026-11-08 済み。`translate="no"` で全語が残り、訳の本文の文字参照は必ず二重にエスケープされて返った。research R3・R4) 実際のキーで v2 に `{"q": "Building Apps with <span translate=\"no\" class=\"notranslate\">React</span> and <span translate=\"no\" class=\"notranslate\">TypeScript</span>", "source": "en", "target": "ja", "format": "html"}` を 1 回送り、`React` と `TypeScript` が残るかと、返る文字参照の形 (`&#39;` など) を確かめる (research R3)。キーは管理者に `! curl ...` で実行してもらい、会話にもファイルにも残さない。残らなければ research.md R3 と contracts/translate-title.md をプレースホルダー方式 (`<span data-k="0"></span>` に置き換えて送り、返った後に語を差し戻す) に直してから先に進む
- [X] T003 [P] `translate.svg` を `frontend/src/shared/ui/icons/translate.tsx` に写す。`export const Translate = ({ size = 16 }: { size?: number })` で `<svg aria-hidden="true" height={size} width={size} viewBox="0 0 24 24"><path fill="currentColor" d="…" /></svg>` を返す (path は `translate.svg` のまま)。コメントは「Material Design Icons の google-translate (Apache-2.0)」の 1 行。写したらリポジトリ直下の `translate.svg` を消す

**Checkpoint**: v2 で固有名称を守れる方式が決まっている

---

## Phase 2: Foundational

- [X] T004 `frontend/src/shared/api/retry.server.ts` に `retry<T>(run: () => Promise<T>): Promise<T>` を作る。最大 3 回 (初回 + 再試行 2 回) 試し、再試行するのは例外のうち `RetryableError` (このファイルで定義し export する) だけ。それ以外の例外はすぐ投げる。待ちは入れない (1 日約 10 件で、レート制限に当たらないため)。`frontend/src/shared/api/retry.server.test.ts` に `it("retries a transient failure up to three attempts")` と `it("does not retry a non-transient failure")` を書く (research R5)
- [X] T005 (2026-11-08、モーダルに移したので取り消し) ~~`board.ts` の `Link` に `translation` を足す~~。翻訳の状態は `EditDialog` の state に持つ (data-model.md)

**Checkpoint**: `just fe-typecheck` と `just test` が通る

---

## Phase 3: User Story 1 - 英語のタイトルを編集画面から日本語にする (Priority: P1) 🎯 MVP

**Goal**: 記事の編集モーダルのタイトル欄の翻訳ボタンで、固有名称を原文の表記のまま残した日本語のタイトルに置き換わる。

**Independent Test**: 本番で `Building Apps with React and TypeScript` の候補の編集モーダルで翻訳を押して確定し、`React` と `TypeScript` を含む日本語に変わり、登録後にトップで同じタイトルが出る (quickstart.md 手順 1〜3、5)。

### Tests for User Story 1

- [X] T006 [P] [US1] `frontend/src/shared/api/title-terms.server.test.ts` に、候補の切り出しと選び方のテストを書く。`it("splits a title into one- to three-word candidates without surrounding punctuation")` (`"Next.js: Building with TanStack Start"` から `Next.js`・`TanStack Start` が候補に入り、`:` が付かない)、`it("keeps the longer term when candidates overlap")` (`TanStack` と `TanStack Start` が両方 0.5 以上なら `TanStack Start` だけ)、`it("drops candidates below 0.5")` (0.49 は入らず 0.5 は入る)
- [X] T007 [P] [US1] `frontend/src/shared/api/title-translation.server.test.ts` に、HTML の組み立てと戻しのテストを書く。`it("wraps each term in a no-translate span and escapes the rest")` (`<` や `&` を含むタイトル)、`it("returns the translation when every term survives with its exact spelling")`、`it("rejects a translation that changed a term's case")` (`react` になったら `null`)、`it("restores the double-escaped characters the translator returns")` (T002 で返った実例 `<span translate="no" class="notranslate">AT&amp;amp;T</span>新しいAPIをリリース` が `AT&T新しいAPIをリリース` になり、`AT&T` の確認を通る。`&amp;lt;div&amp;gt;` が `<div>` になる)、`it("rejects a translation with an unexpected tag")`
- [X] T008 (2026-11-08、モーダルに移したので取り消し) ~~board の翻訳の状態のテスト~~。待つ間に直した欄を上書きしない処理は `EditDialog` の 1 行の比較になり、自明な 1 行なのでテストしない (`.agents/rules/quality.md`)

### Implementation for User Story 1

- [X] T009 [US1] `frontend/src/shared/api/title-terms.server.ts` を作る (research R1、data-model.md の「固有名称の候補」、contracts/translate-title.md の clef への要求)。中身は 3 つ。
  - (a) `candidates(title)`: 空白で区切った語の前後から `:` `,` `(` `)` `"` `'` `!` `?` を外し、空になった語は捨て、1〜3 語の連なりを `{ text, start, end }` (`start` / `end` は語の番号) で返す。語の中の `.` `-` `/` `+` `#` は残す。64 個を超えたら先頭から 64 個にし、`ponytail:` コメントで「clef の質問の上限 64。長いタイトルの後ろは聞かない」と残す
  - (b) `pickTerms(candidates, yes: number[])`: `yes >= 0.5` の候補を長い順 (語数、同じなら前から) に見て、既に選んだ候補と語の番号が重ならないものだけ残し、`text` の配列を返す
  - (c) `extractTerms(title): Promise<string[] | null>`: `category-suggestion.server.ts` と同じく `await import("cloudflare:workers")` を `try` で囲み、失敗したら `null` (コメントは「ローカルの vite dev (Node) には無く、翻訳しないことが spec FR-012」の 1 行)。`env.AI` の確かめ方も同じ。候補が 0 個なら `[]`。`retry(() => ai.run("@cf/cloudflare/clef", { model: "clef", state: { title }, questions }))` を呼ぶ (`run` の例外は `RetryableError` に包む)。`questions` は `t0`〜`tN` に `{ type: "noul", instructions: { question: "この語は製品・サービス・技術・ライブラリ・言語・人・組織の名前か", term } }`。答えは `z.object({ answers: z.record(z.string(), z.object({ type: z.literal("noul"), noul: z.number() })) })` で `parse` し、`tN` の `noul` を (b) に渡す
- [X] T010 [US1] `frontend/src/shared/api/title-translation.server.ts` を作る (research R2〜R4)。中身は 3 つ。
  - (a) `toHtml(title, terms)`: `terms` の各出現を `<span translate="no" class="notranslate">…</span>` で囲み、それ以外の `&` `<` `>` `"` をエスケープした文字列
  - (b) `fromHtml(html, terms): string | null`: `<span …>` と `</span>` を外し、`<` が残れば `null`。その後 `&amp;` `&lt;` `&gt;` `&quot;` `&#NNN;` `&#xHH;` を 2 回戻す (訳の本文は必ず二重にエスケープされて返る、research R4)。コメントは「Cloud Translation v2 は訳の本文の文字参照を二重にエスケープして返す」の 1 行、上限は `ponytail:` で「原文に `&amp;` の文字そのものがあると戻しすぎる」。戻した後に `terms` のどれかが大文字・小文字・記号まで同じ形で含まれなければ `null`
  - (c) `translateWithTerms(title, terms): Promise<string | null>`: `process.env.GOOGLE_TRANSLATE_API_KEY` が無ければ投げる。`retry` の中で `fetch("https://translation.googleapis.com/language/translate/v2", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key }, body: JSON.stringify({ q: toHtml(title, terms), source: "en", target: "ja", format: "html" }) })`。通信の例外と 5xx は `RetryableError`、4xx は通常の `Error` で投げる。答えは `z.object({ data: z.object({ translations: z.tuple([z.object({ translatedText: z.string() })]) }) })` で `parse` し、`fromHtml` に渡す
- [X] T011 [US1] `frontend/src/shared/api/translate-title.ts` にサーバー関数 `translateTitle` を作る (contracts/translate-title.md)。`createServerFn({ method: "POST" })` → `.validator(z.object({ title: z.string().trim().min(1).max(500) }))` → `.handler` の中で `requireAdminToken()`、`extractTerms(data.title)` が `null` なら `null`、そうでなければ `translateWithTerms(data.title, terms)` を返す。判定は挟まない (spec FR-011)。`frontend/src/shared/api/index.ts` から export する
- [X] T012 (2026-11-08、モーダルに移したので取り消し) ~~`board.ts` の `startTranslation` / `settleTranslation`~~
- [X] T013 `frontend/src/pages/digest-editor/ui/draft-card.tsx` の `EditDialog` に、翻訳の状態 `translation: "idle" | "translating" | "failed"` と `useServerFn(translateTitle)` を置く。押したときの欄の値を送り、結果が届いたら欄がその値のままのときだけ置き換える。`null` と例外は `failed`。欄を手で直したら `failed` を `idle` に戻す (data-model.md)。`CardActions` には足さない
- [X] T014 `EditDialog` のタイトル欄を入力欄の型にする。欄と React Aria Components の `Button` (`aria-label="タイトルを翻訳"`、中身は `<Translate />`) を同じ角丸の枠に入れ、1px 線で区切る。フォーカス中は外枠を `--color-accent`。`isDisabled` は `import.meta.env.DEV || translation === "translating" || title.trim() === ""` (spec FR-009、FR-012、Edge Cases)。アイコンは `--color-brand`、押せないときは `--color-text-faint` と `cursor: not-allowed`、押したときの拡大は日付欄のカレンダーボタンに合わせ、`prefers-reduced-motion` で止める (`.agents/rules/frontend-ui-design.md`)。候補の行 (`LinkRow`) には置かない
- [X] T015 タイトル欄の見出しの行の右に、`aria-live="polite"` で「翻訳してます」を出す (欄の下に出すと、下の URL 欄とボタンが動くため)

**Checkpoint**: `just lint && just test` と `just fe-typecheck` が通る。本番で quickstart.md の手順 1〜3、5 を確かめる (マージ後)

---

## Phase 4: User Story 2 - 翻訳の失敗を公開しない (Priority: P1)

**Goal**: 失敗・確認を通らない結果ではタイトルが変わらず、「翻訳できませんでした」が出て、やり直せる。

**Independent Test**: シークレットを誤った値にして翻訳を押し、タイトルが原文のまま「翻訳できませんでした」が出る。もう一度押せる (quickstart.md 手順 6)。

### Implementation for User Story 2

- [X] T016 [US2] T015 と同じ場所に「翻訳できませんでした」を出す (`--color-text-muted`。`--color-danger` は送信を断られたときだけ)。失敗の後もボタンは押せる (T014 の `isDisabled` は `failed` を含まない)
- [X] T017 [US2] 欄を手で直したら失敗の表示を消す (T013 の `onChange`)。自明な 1 行なのでテストしない

**Checkpoint**: `just test` が通る。US2 のシナリオ 1 (語が変わる) と 2 (再試行) は T007 と T004 のテストで押さえる

---

## Phase 5: User Story 3 - 翻訳を取り消して原文に戻す (Priority: P2)

**Goal**: 登録前なら「変更を戻す」で翻訳前の原文に戻る。

**Independent Test**: 翻訳を確定した候補でメニューの「変更を戻す」を押し、英語の原文に戻る (quickstart.md 手順 4)。

### Implementation for User Story 3

- [X] T018 [US3] 変更しない。翻訳は `initial.title` に触れず、「確定」は既存の `editLink` を通るので、`revert` で翻訳前の原文に戻る (spec FR-007)。既存の `board.test.ts` の `it("restores the fetched title and URL but keeps the hot flag, related articles and position")` で押さえる

**Checkpoint**: `just test` が通る

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] `adr-skill` で `adr/frontend/0012-translate-titles-with-clef-noul-and-translation-v2.md` を書き、`adr/frontend/README.md` の一覧に足す。決めたこと: clef の `noul` で 1〜3 語の候補から固有名称を決める (research R1)、Cloud Translation - Basic を API キーで呼ぶ (R2)、T002 の結果で決まった守り方 (R3)、ローカル開発では翻訳しない (R7)
- [X] T020 [P] `docs/tech-stack.md` の AI の行 (70 行目付近) に「記事タイトルの固有名称の抽出 (specs/012)」を足し、翻訳の行 (Cloud Translation - Basic、シークレット `GOOGLE_TRANSLATE_API_KEY`) を足す
- [X] T021 (2026-11-08 済み。本番で `audio-studio-mcp` の説明文を翻訳・確定・変更を戻す・登録まで確かめた。手順 6 の「翻訳できませんでした」は、#107 で書き足しを失敗にしたときに本番で出た) `just lint && just test` と `just fe-typecheck` を通す。e2e は回さない。マージ後に本番で quickstart.md の手順をすべて確かめる

---

## Dependencies & Execution Order

- **Phase 1**: T001 → T002 (キーが要る)。T003 は独立
- **Phase 2**: T004、T005 は T002 の結果を待たずにできる
- **US1 (Phase 3)**: Phase 2 の後。T010 は T002 の結果 (守り方) に従う。T011 は T009・T010 の後、T013 は T011 の後、T014 は T003・T013 の後
- **US2 (Phase 4)**: US1 の後 (状態 `failed` を出す UI が US1 のボタンに乗る)
- **US3 (Phase 5)**: US1 の後。US2 とは独立
- **Polish**: すべての後。T019・T020 は並行できる

## Parallel Example: User Story 1

```text
T006 title-terms.server.test.ts
T007 title-translation.server.test.ts
→ 2 つのテストは別ファイルで並行できる
T009 title-terms.server.ts と T010 title-translation.server.ts も並行できる
```

## Implementation Strategy

1. Phase 1 の T001・T002 で、守り方を実際のリクエストで決める。ここが通らないと T010 の形が決まらない
2. Phase 2 → US1 で MVP (手動で翻訳できて、登録すると公開画面に出る)
3. US2 で失敗の表示とやり直し、US3 で原文に戻せることを確かめる
4. 自動実行と判定は #105 で、`extractTerms` と `translateWithTerms` を呼び出し側から挟む
