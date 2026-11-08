# Contract: translateTitle (サーバー関数)

`createServerFn({ method: "POST" })`。ブラウザから呼べるのはこれだけで、clef と Google Cloud Translation はサーバーの中から呼ぶ。

## 入力

```ts
z.object({ title: z.string().trim().min(1).max(500) })
```

## 認可

`requireAdminToken()` (spec FR-010)。

## 出力

`string | null`

- `string`: 守った固有名称がすべて原文の表記で含まれる日本語のタイトル。
- `null`: 抽出の手段がない (ローカル開発)、固有名称が欠けた・変わった、返った HTML に想定外のタグが残った。
- 例外: 再試行しても clef か翻訳の呼び出しが失敗した、答えの形が schema と違う、API キーが無い。

## 内部の関数 (#105 から使う)

```ts
extractTerms(title: string): Promise<string[] | null>      // null: 抽出の手段がない
translateWithTerms(title: string, terms: string[]): Promise<string | null>
```

`translateTitle` は `extractTerms` → `translateWithTerms` を呼ぶだけで、翻訳が必要かの判定は持たない。

## clef への要求

```ts
env.AI.run("@cf/cloudflare/clef", {
  model: "clef",
  state: { title },
  questions: {
    t0: { type: "noul", instructions: { question: "この語は製品・サービス・技術・ライブラリ・言語・人・組織の名前か", term: "React" } },
    // 候補ごとに t1, t2, … (最大 64)
  },
});
```

答えは `answers.tN` を `{ type: "noul", noul: number }` として Zod で `parse` する。

## Google Cloud Translation への要求

```http
POST https://translation.googleapis.com/language/translate/v2
Content-Type: application/json
X-Goog-Api-Key: $GOOGLE_TRANSLATE_API_KEY

{ "q": "Building Apps with <span translate=\"no\" class=\"notranslate\">React</span> and …", "source": "en", "target": "ja", "format": "html" }
```

答えは `{ data: { translations: [{ translatedText: string }] } }` を Zod で `parse` する。
