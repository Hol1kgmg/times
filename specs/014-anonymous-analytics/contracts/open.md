# Contract: POST /open (specs/013 の契約を置き換える)

公開画面の閲覧と記事リンクのクリックを受け付ける Workers のサーバールート。backend (Cloud Run) は通らない。

## Request

```http
POST /open
Content-Type: application/json

{ "event": "article_click", "clientId": "…uuid", "articleId": "…uuid", "url": "https://example.com/post", "entryDate": "2026-11-09" }
{ "event": "page_view", "clientId": "…uuid", "location": "https://z-times.dev/timeline", "title": "#timeline | z_times.dev" }
```

ブラウザからは `fetch("/open", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body })` で送り、応答は待たない・見ない。

## Response

| 状況 | ステータス | GA4 へ送るか |
|---|---|---|
| 形が合う | 204 | 送る (`waitUntil`) |
| 形が合う + UA が bot | 204 | 送らない |
| 形が合う + `GA_MEASUREMENT_ID` / `GA_API_SECRET` が空 | 204 | 送らない |
| 4 KB を超える・JSON でない・`event` が不明・項目の欠け・形式の誤り (`clientId` が UUID でないなど) | 400 | 送らない |

- 本文は返さない。bot かどうか・送ったかどうかを応答で区別しない。
- GA4 への送信の失敗は記録 (console) するだけで、再送しない。
- `event` のない specs/013 の形式は 400 になる。

## Client

```ts
reportArticleOpen(entryDate)(article: { id: ArticleId; url: string }): void  // DigestPost の onOpen (specs/013 と同じ)
reportPageView(): void                                                       // __root の部品から呼ぶ
```

- どちらも `anonymousId()` を `clientId` に付ける。
- `reportPageView` は `location.origin + location.pathname` と `document.title` を送る。
- `__root` の部品は、解決済みの最後の match の routeId が公開画面 ([data-model.md](../data-model.md)) のときだけ、直前に送った pathname と違えば呼ぶ。
