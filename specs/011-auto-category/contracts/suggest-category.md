# Contract: suggestCategory (サーバー関数)

`createServerFn({ method: "POST" })`。ブラウザから呼べるのはこれだけで、Workers AI はサーバーの中から呼ぶ。

## 入力

```ts
z.object({
  url: newChildArticle.shape.url,   // http / https の URL
  title: z.string().max(500),       // 取れなかったときは ""
})
```

## 認可

`requireAdminToken()`。未ログインは既存のサーバー関数と同じ扱い (FR-008)。

## 出力

`Category | null`

- `null`: 推定の手段がない (ローカル開発)、確からしさが 0.5 未満、選択肢の外の答え。
- 例外: Workers AI の呼び出しの失敗、答えの形が schema と違う。クライアントは `catch` して未分類のまま残す (FR-007)。

## Workers AI への要求

```ts
env.AI.run("@cf/cloudflare/clef", {
  model: "clef",
  state: { url, title },
  questions: {
    category: {
      type: "choice",
      instructions: "この記事はどのカテゴリに入るか",
      criteria: { /* category.options の各値 → 説明 */ },
    },
  },
});
```

答えは `answers.category` を `{ type: "choice", choice: string, probabilities: Record<string, number>, confidence: number }` として Zod で `parse` する。
