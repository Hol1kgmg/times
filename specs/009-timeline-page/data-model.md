# Data Model: Digest のタイムライン画面

新しい保存データはない。specs/008 の `digestPage` (`{ digests: Digest[] }`、新しい順) を画面の状態に写す。

## 画面の状態 (`pages/digest-timeline`)

| 項目 | 型 | 初期値 | 意味 |
|---|---|---|---|
| `digests` | `Digest[]` | loader のページを古い順にしたもの | 上から古い順に並べる列 |
| `done` | `boolean` | loader のページが 7 件未満 | それより古い公開の Digest がない |
| `status` | `"idle" \| "loading" \| "error"` | `"idle"` | 上端の状態表示 |

### 遷移

```text
idle  --上端が見えた && !done--> loading
loading --成功--> idle   (digests の前に足す。返った件数 < 7 なら done = true)
loading --失敗--> error  (digests はそのまま)
error --再試行を押す--> loading
```

- `done` のときは見張らず、状態表示の行は空のまま高さだけを取る
- `digests` が 0 件 (loader の時点) なら「まだ記事がないです」を出し、見張らない (`done` も true)

## `prependPage(current, page)` (model/timeline.ts)

- 入力: いまの `digests` (古い順) と、返ったページ (新しい順)
- 出力: `{ digests: [...page を逆順, ...current], done: page.length < PAGE_SIZE }`
- `PAGE_SIZE = 7` (specs/008 の既定と同じ。サーバー関数には明示して渡す)
- 初回は `prependPage([], loaderPage)` で同じ関数を通す
