# Research: 記事登録 (Digest 作成) 画面

## R1. ドラッグの実装

- **Decision**: `@dnd-kit/react` + `@dnd-kit/helpers` を 0.5.1 で固定して入れる。times-news の `SortableArea` と同じく、`DragDropProvider` の `onDragOver` で `move()` を呼び、箱 ID → 候補 ID の配列を組み替える。各候補は `useSortable({ id, index, group: boxId })`、各箱は `useDroppable({ id: boxId })` で空の箱にも落とせるようにする。
- **追記 (実装時)**: 箱そのもの (見出し・空き) に落としたときの `move()` は先頭に入れるので、`moveToBoxEnd` で末尾に入れる (spec Edge Cases)。既定の読み上げが英語で記事の UUID を読むため、`@dnd-kit/dom` (0.5.1) を直接の依存に足し、`Accessibility.configure` で日本語のタイトルを読ませる (`ui/announcements.ts`)。
- **Rationale**: ポインター (マウス・タッチ) とキーボードのセンサーが既定で入っており、FR-013 を追加実装なしで満たせる。times-news で同じ使い方を動かした実績がある。0.5.1 は 2026-10-15 公開で、`pnpm-workspace.yaml` の `minimumReleaseAge` (2 日) を満たす。
- **Alternatives considered**:
  - HTML5 ネイティブ DnD: タッチ非対応、キーボード操作とドロップ位置の表示が自前になる。
  - `motion` の `Reorder`: 導入済みだが、リストをまたぐ移動ができない。
  - times-news の `SortableArea` 一式 (`renderLayoutTree` + `react-resizable-panels`): 配置は「未分類 + 6 カテゴリ」で固定なので、レイアウト木とリサイズは要らない (constitution IV)。

## R2. ドラッグ中の再レンダリング

- **Decision**: times-news と同じく、`move()` が入力と同じ参照を返したら state を更新しない。中身の変わらない箱は配列の参照を使い回す (`fromIds`)。箱の `memo` は付けない (実装時に変更)。
- **Rationale**: `onDragOver` はポインター移動のたびに呼ばれ、大半は並びが変わらないので、そこで打ち切れば再描画は並びが変わったときだけになる。`memo` を効かせるにはカードへ渡す操作関数を安定させる仕組み (最新の board を ref で読むなど) が要り、100 件規模では見合わない。重くなったら `memo` + 安定した操作関数を足す。

## R3. 掴む場所 (ハンドル)

- **Decision**: 記事カードの左端にハンドル (`⠿`、`button`) を置き、`useSortable` の `handle` に渡す。関連記事のカードは sortable にせず、親カードの中に描く。
- **Rationale**: カード全体を掴めると、タイトルのリンク・`···` メニュー・編集欄の操作とドラッグがぶつかる。ハンドルはキーボードでフォーカスでき、Space で掴める。関連記事を sortable にしなければ、単独でドラッグできない (FR-020) ことが構造で保証される。

## R4. タイトルの自動取得

- **Decision**: `pages/home/api/get-link-preview.ts` の「fetch → `</head>` まで読む → 文字コードを決めて復号 → `parseLinkPreview` → Workers Cache に保存」を `shared/api/link-preview.server.ts` の `loadLinkPreviewCached(url)` に移す。トップの `getLinkPreview` は「最新 Digest に載っている URL だけ」のガードを残してこれを呼ぶ。新しい `fetchDraftTitle` は管理者の Cookie を確認してから呼び、`title` だけを返す。
- **Rationale**: 取得処理は Shift_JIS 対応・YouTube の巨大な head・5 秒のタイムアウトなど既に面倒を見ており、二重に書く理由がない。公開エンドポイントのまま任意 URL を受けると踏み台になるので、管理者に限った別のサーバー関数にする。キャッシュも共有するので、登録直後のトップのプレビューは取得済みの値を使える。
- **Alternatives considered**: backend に取得 API を足す → backend からの外部 fetch と OpenAPI の追加が要り、既存の frontend 側の実装と二重になる。

## R5. 候補 ID

- **Decision**: `crypto.randomUUID()` で作る文字列。送信時には捨てる。
- **Rationale**: dnd-kit の ID と React の key を兼ねる。URL は訂正で変わるので ID にできない (FR-016)。

## R6. `···` メニュー

- **Decision**: `button` (`popoverTarget`) + `popover="auto"` の `<div>` にボタンを並べる。`role="menu"` は矢印キーでの移動を自前で書く必要があるので付けない。位置は CSS anchor positioning (`anchor-name` を行の `anchor-scope` に閉じる。`pages/home/ui/digest.module.css` のプレビューと同じ型)。見た目は `--shadow-menu` + `--radius-control`。
- **Rationale**: 外側クリックと Esc で閉じる処理、最前面への表示をブラウザに任せられる。主な利用環境は PC の Chrome。
- **Alternatives considered**: state で開閉して absolute 配置 → 外側クリック・Esc・箱の `overflow` による切れを自前で処理することになる。

## R7. 編集

- **Decision**: メニューの「編集」でカードをその場で入力欄 (タイトル・URL) に切り替える。`<form>` の submit で確定、「やめる」ボタンと Esc で破棄。URL は `type="url"` + `required`、タイトルは `maxLength={300}`。確定時に重複判定 (FR-007) を通す。
- **Rationale**: 一覧から離れずに直せる (spec Story 3)。入力の補助は HTML 属性、形式の最終判定は登録時の `newDigest` (quality.md)。

## R8. 離脱確認

- **Decision**: TanStack Router の `useBlocker({ shouldBlockFn, enableBeforeUnload })` を使う。候補が 1 件以上あり、登録処理中でないときだけ止める。アプリ内の遷移は `window.confirm`、再読み込み・タブを閉じる操作はブラウザ標準の `beforeunload` の確認。
- **Rationale**: サイドバーのリンクでの離脱も「離脱」に含まれる。登録成功のリダイレクトは登録処理中フラグで素通しする。

## R9. 関連記事を持つ記事の削除確認

- **Decision**: `window.confirm` で「関連記事 N 件も消えます」と確認する。
- **Rationale**: 確認ダイアログの見た目を作る必要があるのはこの 1 か所だけで、管理者 1 名の画面。

## R10. 登録の失敗

- **Decision**: `createDigest` の例外を 2 つに分ける。`isNotFound(e) && e.data.reason === SESSION_EXPIRED` なら「ログインし直してください」、それ以外は「同じ URL が重複していないか確認してください」。候補はそのまま残す。
- **Rationale**: backend の 400 は 1 つの Digest 内での URL の重複か形式違反で、形式は送信前に `newDigest` で弾いている。backend の `detail` は UI に出さない (quality.md)。
