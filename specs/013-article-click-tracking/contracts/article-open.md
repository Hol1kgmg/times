# Contract: POST /open

公開画面の記事リンクが押されたことを受け付ける Workers のサーバールート。backend (Cloud Run) は通らない。

## Request

```http
POST /open
Content-Type: application/json

{ "articleId": "0b6c…-uuid", "url": "https://example.com/post", "entryDate": "2026-11-09" }
```

ブラウザからは `fetch("/open", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body })` で送り、応答は待たない・見ない。

## Response

| 状況 | ステータス | GA4 へ送るか |
|---|---|---|
| 形が合う | 204 | 送る (`waitUntil`) |
| 形が合う + UA が bot | 204 | 送らない |
| 形が合う + `GA_MEASUREMENT_ID` / `GA_API_SECRET` が空 | 204 | 送らない |
| 本文が JSON でない・項目の欠け・形式の誤り | 400 | 送らない |

- 本文は返さない。bot かどうか・送ったかどうかを応答で区別しない。
- GA4 への送信の失敗は記録 (console) するだけで、再送しない。

## Client: DigestPost

```ts
type DigestPostProps =
  | { digest: Digest; onOpen?: (article: { id: ArticleId; url: string }) => void; … }
  | { digest: DigestContent; onOpen?: never; … };
```

- トップ (`digest-card.tsx`) とタイムライン (`timeline-page.tsx`) が `onOpen` を渡す。プレビュー (`preview-dialog.tsx`) は渡さない。
- `ArticleLink` は `onPress` と `onAuxClick` (`button === 1`) で `onOpen` を呼ぶ。`href` は記事の URL のまま。
