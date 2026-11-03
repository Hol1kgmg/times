# Research: Digest のタイムライン画面

## R1. 未ログインの扱い

- **Decision**: `beforeLoad` で `currentAdmin()` を見るサーバー関数 (`resolveTimelinePage`) を呼び、いなければ `notFound()`。編集画面の `resolveDigestEditorPage` と同じ形を、ページのスライスの中に置く。
- **Rationale**: pages どうしは import できない。ログイン画面へ飛ばすと、ログインの入口のパスを隠している意味がなくなる (specs/003)。
- **Alternatives**: `resolveDigestEditorPage` を `shared` に上げる → 名前と置き場所を変える差分が増え、得るものがない。2 か所目なので、3 か所目が来たら上げる。

## R2. 読み足しのきっかけ

- **Decision**: 投稿の列の上に状態表示の行 (読み込み中 / 失敗 + 再試行 / 空) を置き、その行を `IntersectionObserver` で見張る。effect は「読み込み中でも失敗でも終わりでもない」ときだけ見張りを作り、読み込みが終わるたびに作り直す。作り直した見張りは最初に今の交差を通知するので、中身が画面より短ければそのまま次を読み、画面が埋まるまで続く (FR-008)。
- **Rationale**: スクロールイベントで位置を測るより短く、間引きも要らない。作り直しで「埋まるまで続ける」が追加のコードなしで得られる。失敗のときは見張りを作らないので、失敗のたびに読み込みを繰り返さない (FR-009)。
- **Alternatives**: スクロールイベント + `scrollY < 閾値` → 間引きと「短いときに続けて読む」を別に書くことになる。無限スクロールのライブラリ → 依存が増える (constitution IV)。
- **上限**: 読み足した投稿はすべて DOM に残す。`// ponytail: 全件を DOM に積む。数百件で重くなったら仮想化する` を残す。

## R3. 差し込み時に位置を保つ

- **Decision**: 読み込みが返ったら、差し込む前に `document.documentElement.scrollHeight - window.scrollY` (下端からの距離) を ref に取り、state を更新する。`useLayoutEffect` で、ref があれば `window.scrollTo(0, scrollHeight - 距離)` に合わせて ref を消す。スクロールは `main` ではなくページ全体 (`root-layout` の `.layout` は `min-height: 100vh` でサイドバーが sticky)。
- **Rationale**: Safari は `overflow-anchor` に未対応で、上に足すと内容が下へずれる。paint 前に合わせるので、ずれが見えない。動きは付けないので `prefers-reduced-motion` の扱いも要らない。
- **Alternatives**: `overflow-anchor` に任せる → Safari でずれる。`flex-direction: column-reverse` のスクロール容器 → ページのスクロールでなく入れ子のスクロールになり、UI ルール (入れ子のスクロールは使わない) に反する。

## R4. 初回に最下段を見せる

- **Decision**: 画面の `useLayoutEffect` (初回だけ) で `window.scrollTo(0, scrollHeight)`。router の `scrollRestoration: true` が後から先頭へ戻す場合は、サイドバーの `#timeline` のリンクに `resetScroll={false}` を付ける。どちらが要るかは実装時に確かめる (quickstart 2)。
- **Rationale**: 新しい履歴エントリでは router が先頭へスクロールし、子の layout effect より後に走る可能性がある。直接 URL で開いたとき (SSR) は復元する位置がないので、画面の effect だけで足りる。
- **Alternatives**: `requestAnimationFrame` で遅らせる → 一瞬先頭が見えてから飛ぶ。

## R5. プレビューの取得

- **Decision**: `pages/digest-editor/api/fetch-draft-preview.ts` と `load-draft-preview.ts` を `shared/api/fetch-any-link-preview.ts` / `load-any-link-preview.ts` に移し、`fetchAnyLinkPreview` / `loadAnyLinkPreview` に改名する。中身 (`requireAdminToken()` + `loadLinkPreviewCached`) は変えない。編集画面の 3 ファイルは import 先だけ変える。
- **Rationale**: トップの `getLinkPreview` は最新の Digest の URL に限るので、過去の日の記事は取れない。管理者限定の任意 URL の取得はすでにあり、タイムラインもログイン中 = 管理者だけが開く。「draft」は編集画面の言葉なので、共有するなら名前から外す。
- **Alternatives**: タイムライン用に「公開の Digest に含まれる URL だけ」を確かめるサーバー関数を作る → backend に URL の照会が要る。ログインユーザーに限るので踏み台の心配は小さく、今は要らない。一般ユーザーができたときに specs/008 の `ponytail:` (トークンの差し替え) と一緒に見直す。

## R6. テスト

- **Decision**:
  - Vitest: `model/timeline.ts` の `prependPage(current, page)` (新しい順のページを古い順にして前に足し、件数が 7 未満なら終わりにする) に 2 件 (7 件なら続きあり、7 件未満なら終わり)。
  - Playwright: 新しいファイルは作らず、`digest-new.spec.ts` の登録 → トップの確認の後に「サイドバーの `#timeline` を開くと、登録した Digest が最下段にあって見えており、日付が上から古い順」を足す。
  - 自動読み込み・位置の保持・失敗の再試行は quickstart の手動確認。
- **Rationale**: e2e の DB は spec の間で共有され、最新の日付は `digest-new.spec.ts` が実行ごとに更新している。別ファイルで Digest を登録すると、トップの最新を奪うか、タイムラインの最下段に来ないかのどちらかになる。登録 → タイムラインもつながりの 1 本なので、同じ spec に並べるのが自然 (quality.md: つながりにつき 1 本)。読み足しは e2e の DB の件数に左右され、件数を揃えるには 8 件以上の登録が要る。
- **Alternatives**: `digest-timeline.spec.ts` を新設して 2100 年より後の日付で登録 → `digest-new.spec.ts` のトップの確認が壊れる。

## R7. 見出し

- **Decision**: ページの先頭に `<h1>` を置かず、ルートの `head` で `<title>` を付けるだけにする。
- **Rationale**: チャットログの先頭は読み込みの状態表示で、見出しを置くと最古の投稿の上に固定の文字が出続ける。どのチャンネルかはサイドバーの選択中の見た目で分かる。
- **Alternatives**: 見えない `<h1>` → global.css に視覚的に隠すクラスがなく、足すとトークン外の値が要る。必要になったら足す。
