# Contract: OpenAPI の変更

正は `backend/api/openapi.yaml`。ここには差分だけを書く。

## Article (変更)

```yaml
Article:
  properties:
    firstPublishedOn:
      type: string
      format: date
      description: 再掲載のときだけ入る。この記事が載っている公開済み Digest のうち、この Digest より前でいちばん古い日付
```

`required` には足さない。`ChildArticle` には足さない (子は新しい記事だけ)。

## SavedDigest (新規)

```yaml
SavedDigest:
  allOf:
    - $ref: "#/components/schemas/Digest"
    - type: object
      required: [repostedUrls]
      properties:
        repostedUrls:
          type: array
          items:
            type: string
          description: この保存で新しく再掲載になった記事の URL。保存前から載っていた再掲載は含めない
```

- `POST /digests` の `201` と `PUT /digests/{entryDate}` の `200` を `Digest` から `SavedDigest` に変える
- 読み取り (`GET /digests/latest`、`GET /digests/{entryDate}`、`GET /digests/published`) は `Digest` のまま

## Problem (変更)

```yaml
type:
  enum:
    - /problems/repost-needs-child   # 追加
duplicateUrls:
  description: url-already-registered と repost-needs-child のときだけ入る。該当する URL すべて
```

- `repost-needs-child`: 登録済みの URL を、新規の子を付けない親として入れた (400)

## router テスト (cmd/server/main_test.go)

操作は増えないので足さない。`repost-needs-child` の Problem の形は `apperr` の unit テストで押さえる。
