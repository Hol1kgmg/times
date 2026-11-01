# Contract: openapi.yaml の差分

## スキーマ

```yaml
DigestStatus:
  type: string
  enum: [draft, published, private]
  description: draft は一度も公開していない、private は公開した後に取り下げた

Digest:          # required に status を足す
  properties:
    status: { $ref: "#/components/schemas/DigestStatus" }

DigestSummary:   # required に status を足す
  properties:
    status: { $ref: "#/components/schemas/DigestStatus" }

NewDigest:       # 作成用。status は任意
  properties:
    status:
      type: string
      enum: [draft, published]
      default: draft

DigestUpdate:    # 更新用。NewDigest と同じ entryDate / articles に、draft を含まない status
  type: object
  required: [entryDate, articles]
  properties:
    entryDate: { type: string, format: date }
    articles:  { type: array, minItems: 1, maxItems: 100, items: { $ref: "#/components/schemas/NewArticle" } }
    status:
      type: string
      enum: [published, private]
      description: 省略すると今のステータスのまま。draft へは戻せない
```

## 操作

| 操作 | 変更 |
|---|---|
| `listDigests` | `security: [bearerAuth: []]` と 401 を足す |
| `getLatestDigest` | 説明を「公開の Digest のうち最新」に、404 を「公開の Digest が 1 件もない」に |
| `getDigestByDate` | `security: [bearerAuth: []]` と 401 を足す |
| `createDigest` | 変更なし (`NewDigest` が status を持つ) |
| `updateDigest` | requestBody を `DigestUpdate` に |

## router テスト (`cmd/server/main_test.go`)

| 表 | 行 |
|---|---|
| `TestRouter` | `GET /digests` を 200 → 401。`GET /digests/2026-10-17` と `GET /digests/not-a-date` を 401 (認証が検証より先)。`detail: gone` の確認は `GET /digests/latest` に移す |
| `TestBearerAuth` | `PUT /digests/2026-10-17` に有効な Bearer と `"status":"draft"` → 400 (draft に戻せない、SC-004) |
| `TestUnexpectedError` | 未認証で通る `GET /digests/latest` に替える |
