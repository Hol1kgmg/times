# Contract: OpenAPI の変更

正は `backend/api/openapi.yaml`。ここには差分だけを書く。

## Article (変更)

```yaml
Article:
  required: [..., repost]
  properties:
    repost:
      type: boolean
      description: 元の記事を参照する再掲載の掲載か。true なら hot は常に false
    category:
      description: 再掲載で子があれば子のカテゴリ。それ以外は記事のカテゴリ
    firstPublishedOn:
      type: string
      format: date
      description: 再掲載のときだけ入る。この記事が載っている公開済み Digest のうち、この Digest より前でいちばん古い日付
```

## ChildArticle / NewChildArticle (変更)

```yaml
ChildArticle:
  required: [..., hot]
  properties:
    hot:
      type: boolean
      description: 親が HOT なら常に true
NewChildArticle:
  properties:
    hot:
      type: boolean
      default: false
```

## RepostArticle (新規)

```yaml
RepostArticle:
  type: object
  required: [repostOf, category]
  properties:
    repostOf:
      type: string
      format: uri
      description: 再掲載する記事の URL。タイトル・カテゴリは記事のものを使い、書き換えない
    category:
      $ref: "#/components/schemas/Category"
      description: 子のカテゴリ。子がなければ記事のカテゴリと同じでなければならない
    children:
      type: array
      items:
        $ref: "#/components/schemas/NewChildArticle"
```

- `NewDigest.articles` / `UpdateDigest.articles` の要素を `oneOf: [NewArticle, RepostArticle]` にする。`NewArticle` は `url` と `title`、`RepostArticle` は `repostOf` を必須にするので、どちらか一方にだけ当たる
- `RepostArticle` は `hot` を持たない (FR-016)

## Problem (変更)

```yaml
type:
  enum:
    - /problems/repost-unavailable   # 追加
duplicateUrls:
  description: url-already-registered と repost-unavailable のときだけ入る。該当する URL すべて
repostable:
  type: array
  description: url-already-registered のときだけ入る。duplicateUrls のうち、再掲載にできる親の URL と元の記事
  items:
    type: object
    required: [url, title, category, firstPublishedOn]
    properties:
      url: { type: string }
      title: { type: string }
      category: { $ref: "#/components/schemas/Category" }
      firstPublishedOn: { type: string, format: date }
```

- `repost-unavailable`: 再掲載として送った記事がない、または前の日付の公開済み Digest に載っていない (400)

## 消すもの (初版から)

- `SavedDigest` / `repostedUrls`: `POST /digests` の `201` と `PUT /digests/{entryDate}` の `200` は `Digest` に戻す
- `/problems/repost-needs-child`

## router テスト (cmd/server/main_test.go)

操作は増えないので足さない。`oneOf` の振り分け (両方の形に当たる要素は 400) を 1 件足す。`repost-unavailable` の Problem の形は `apperr` の unit テストで押さえる。
