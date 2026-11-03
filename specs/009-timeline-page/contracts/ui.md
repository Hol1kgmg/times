# UI Contract: Digest のタイムライン画面

## ルート

| パス | ファイル | beforeLoad | loader |
|---|---|---|---|
| `/timeline` | `app/routes/_shell/timeline.tsx` | `resolveTimelinePage()`: `currentAdmin()` が無ければ `notFound()` | `listPublishedDigests({ data: { limit: 7 } })` |

- `head`: `<title>` を付ける (R7)
- 未ログインで直接開く → 見つからない画面 (FR-001)

## サーバー関数

| 名前 | 置き場所 | 入力 | 出力 | 認可 |
|---|---|---|---|---|
| `listPublishedDigests` | `shared/api` (既存、specs/008) | `{ before?: ISO 日付, limit?: 1〜31 }` | `digestPage` | `requireAdminToken` |
| `fetchAnyLinkPreview` | `shared/api` (移動 + 改名、R5) | URL | `LinkPreview \| null` | `requireAdminToken` |
| `resolveTimelinePage` | `pages/digest-timeline/api` (新規) | なし | `{ user }` / `notFound` | `currentAdmin` |

読み足しの呼び出し: `listPublishedDigests({ data: { before: digests[0].entryDate, limit: 7 } })`

## サイドバー

- `ChannelNav` で `viewer.kind === "admin"` のときだけ、`#general` の直後に `<HoverLink to="/timeline"># timeline</HoverLink>` (FR-002)
- 選択中の見た目は既存の `HoverLink` の active に任せる

## 画面の上端の状態表示 (FR-009)

| status | 表示 | 見張り |
|---|---|---|
| `idle` かつ `!done` | なし (高さだけ取る) | する |
| `loading` | 「読み込み中」(`.t-meta`、`--color-text-muted`) | しない |
| `error` | 「読み込めませんでした」+ ボタンの型の「再試行」 | しない |
| `done` | なし (高さだけ取る) | しない |

- 状態表示の行は普段から最大の高さ (ボタンの高さ) を取り、出し入れで投稿の位置を動かさない (UI ルール: 押す対象を動かさない)
- 読み込み中・失敗の文言は `role="status"` で読み上げる
