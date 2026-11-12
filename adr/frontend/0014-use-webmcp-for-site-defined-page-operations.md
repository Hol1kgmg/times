---
status: 'accepted'
date: 2026-11-12
decision-makers: 'Hol1kgmg'
---

# WebMCP は画面の状態をサイトが決めた操作として渡すために使い、トップの行き先の案内から試験導入する

## Context and Problem Statement

WebMCP は、ページが `navigator.modelContext` (最新の草案では `document.modelContext`) にツールを登録し、ブラウザの中のエージェントに呼ばせる実験段階の API。Chromium は `--enable-features=WebMCP` を付けたときだけ動き、Playwright 1.64 (導入済み 1.64.1) の `page.webmcp.tools()` / `callTool()` で e2e を書ける。

エージェントにこのサイトを扱わせる手段は、WebMCP のほかに 2 つある。導入する前に、WebMCP でなければできないことを決めておく。

| 手段 | ブラウザの状態 | 操作を決めるのは |
|---|---|---|
| サーバー関数・API を直接 (MCP サーバーなど) | 持たない。保存済みのデータだけ | API の形 |
| DOM を操作するエージェント | 持つ | エージェント (画面を読んで推測する) |
| WebMCP | 持つ | サイト (ツールとして定義する) |

## Decision

**WebMCP は、ブラウザの状態 (セッション・画面の中の状態・人が見ている画面) を持ったまま、サイトが決めた操作をエージェントに渡すために使う。** ツールの組み合わせと入力は、画面と閲覧者から型で導く。

1. **ツールは画面の状態を操作する。** `execute` はルーターや画面の state を更新する。サーバー関数を 1 対 1 で包むだけのツールは作らない (それなら API で足りる)
2. **確定の操作はツールにしない。** 登録・公開・ログアウトは人がボタンを押す
3. **ツールの出し分けは認可ではない。** サーバー関数は HTTP の口で、ツールを隠しても誰でも呼べる。認可は今のまま `requireAdminToken` と backend の `bearerAuth` が行う。出し分けは、エージェントに使えない選択肢を見せないためにする
4. **権限は adr/frontend/0013 のブランド型で受ける。** 管理者向けのツールや行き先は、照合済みの `viewer.admin` があるときにしか作らない。ツールの説明や入力に `AdminViewer` の中身を入れない。秘匿パス (`loginPath`) をエージェントに出さないため
5. **入力は Zod で定義する。** `z.toJSONSchema` で `inputSchema` を作り、`execute` の中で `parse` する。エージェントからの入力は信頼境界の外にある
6. **ブラウザ API の型は仕様の団体が出す `webmcp-types` を使い、`document.modelContext` に触るのは `shared/lib/webmcp.ts` だけにする。** 手書きの型は仕様から遅れ、`execute` の `signal` や注釈が欠けるため。API がなければ何もしない。登録は画面の effect で行い、`AbortSignal` で外す。SSR では登録しない

### 最初のツール: トップの `navigate`

ログインの有無で中身を比べやすいので、トップ (`/`) にページの行き先を案内する `navigate` を 1 つだけ置く。

- 行き先は `channelsFor(viewer)` から作る。サイドバーも同じ一覧から作り、片方だけ行き先が増えないようにする。`to` は TanStack Router の型で縛る
- 入力 `{ to }` の enum を閲覧者の行き先から作るので、`tools()` の `inputSchema` でログイン前後の差が見える
- 行き先:

  | 行き先 | 未ログイン | ログイン中 |
  |---|---|---|
  | `/timeline` | `planned` (説明に「公開予定。今は開けない」と書く) | `open` |
  | `/admin/digests/new` (記事を登録) | なし | `open` |
  | `/admin/digests` (記事を編集) | なし | `open` |

- `planned` の行き先も、呼ばれたらそのまま移る。今の未ログインの `/timeline` は 404 になる。比べやすさを優先する試験導入なので、呼んでも移らずにエラーを返す形にはしない
- トップ自身 (`#general`) とログアウトは行き先に入れない

### Non-goals

- 公開データを読むだけのツール (HTML と RSS で足りる)
- 編集画面の下書きの操作 (分類・ホット・関連記事)。WebMCP の本命だが次の段階にする
- フォームに属性を書く宣言的な API、polyfill
- 全ツールをまとめた一覧。ツールが増え、名前の重複を型で防ぎたくなったら作る
- specs/016 の範囲 (31 日) で入力を変えるツール

## Consequences

- Good, because ログインの有無で同じツールの入力が変わる形を、小さな範囲で確かめられる
- Good, because サイドバーと WebMCP の行き先が 1 つの定義にそろう
- Bad, because 普通のリンクで行ける先なので、DOM を操作するエージェントに比べて得るものは少ない。目的は型で出し分ける形の確認と割り切る
- Bad, because API は実験段階で変わりうる。`webmcp-types` を上げて typecheck で落ちた所と `shared/lib/webmcp.ts` を直す
- Bad, because 未ログインのエージェントを、わざと 404 へ送る行き先がある。specs/016 で公開するまでの間だけ

## Implementation Plan

- **Affected paths**:
  - `frontend/src/shared/lib/webmcp.ts` (新規): `defineTool`、`registerTool(tool, signal)`。ブラウザ API の型は `webmcp-types` (devDependencies、`tsconfig.json` の `types`)
  - `frontend/src/shared/config/channels.ts` (新規): `channelsFor(viewer)` と `ChannelPath`。`app/layout/sidebar.tsx` と `pages/home` の両方から使うので `shared` に置く (FSD で `pages` は `app` を import できない)
  - `frontend/src/app/layout/sidebar.tsx`: 行き先を `channelsFor` から描く。`#general` とログアウトのタブはサイドバーに残す
  - `frontend/src/pages/home/model/navigate-tool.ts` (新規) と `ui/home-page.tsx`: ツールを定義し、effect で登録する。行き先の説明はエージェント向けの文なので、ここに置き、`scripts/fixed-chars.ts` の走査から外す (`ai-chat.ts` と同じ。adr/frontend/0005)
  - `frontend/e2e/webmcp.spec.ts` (新規): WebMCP の確認。ファイルの先頭で `test.use({ launchOptions: { args: ["--enable-features=WebMCP"] } })`。ほかの spec をフラグ付きで動かさないため、ファイルを分ける
- **Pattern**:
  - `ChannelPath` は `as const satisfies` で TanStack Router の `to` の型に縛る。存在しないパスは typecheck で落ちる
  - `navigate` の `execute` は router の `navigate({ to })` を呼ぶだけ。結果は `{ content: [{ type: "text", text }] }`
  - 注釈は付けない (`readOnlyHint` は画面が移るので false で、既定と同じ)
  - e2e の入力は `satisfies { to: ChannelPath }` で書く
- **Patterns to avoid**:
  - `viewer` を丸ごとツールに渡す
  - `modelContext` を `shared/lib/webmcp.ts` の外で触る
  - 管理者向けの行き先を `planned` で未ログインに見せる (秘匿でないパスでも、ログイン後にだけある画面の存在は出さない)
- **Tests**:
  - Vitest 1 件: `channelsFor` が未ログインには `/timeline` の `planned` だけを返す。管理者の場合は、`AdminViewer` をテストから作れない (照合の parse からしか作れない) ので型に任せる
  - Playwright は `webmcp.spec.ts` に 1 本: ログインを前提 (`loggedInState`) にし、`navigate` で `/admin/digests/new` を呼ぶと記事の登録の画面に移る。ログイン状態による行き先の違いは確かめない (quality.md: ログイン状態を確かめる e2e は `admin-login` の 1 本だけ)。違いは Vitest の `channelsFor` と型で押さえる

### Verification

- [x] `just lint && just test`、`just fe-typecheck` (2026-11-12)
- [x] `just fe-test-e2e webmcp admin-login` (2026-11-13、2 件)
- [x] フラグなしの Chromium でトップを開いても、エラーが出ない (2026-11-12、Playwright のフラグなしの Chromium)
- [x] `grep -rn "modelContext" frontend/src` が `shared/lib/webmcp.ts` の中だけ

## Revisit

- specs/016 を実装したら、未ログインの `/timeline` を `open` にする
- 型で出し分ける形を確かめたら、編集画面の下書きの操作に広げる (別の ADR か spec)
- WebMCP がフラグなしで動くようになったとき、または普段使うエージェントが WebMCP のツールを読めると分かったときに、範囲を見直す
- 人がいない処理 (夜間の自動分類など) をエージェントにさせたくなったら、WebMCP ではなく API 側で考える

## More Information

2026-11-12、Playwright 1.64.1 の Chromium (`--enable-features=WebMCP`) で確かめた API:

- `document.modelContext` にあり、`navigator.modelContext` にはない。フラグがなければどちらにもない
- `registerTool(tool, { signal })` は Promise を返し、`signal` の abort でツールが外れる。`unregisterTool` はない
- 注釈はページの側で `readOnlyHint` と書き、Playwright の `tools()` には `readOnly` として出る
