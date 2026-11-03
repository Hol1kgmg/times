# Contract: openapi.yaml の差分

## paths

`/digests/latest` の次に置く。

```yaml
  /digests/published:
    get:
      operationId: listPublishedDigests
      description: 管理者が作成した公開の Digest を、記事ごと日付の新しい順に返す。limit は Digest の件数で数え、1 件の記事は切らない。before を渡すとその日付より前 (その日付を含まない) を返す。ログインユーザーなら誰でも使える (今ログインできるのは管理者だけ)
      security:
        - bearerAuth: []
      parameters:
        - name: before
          in: query
          schema:
            type: string
            format: date
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 31
            default: 7
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DigestPage"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
```

## components/schemas

```yaml
    DigestPage:
      type: object
      required: [digests]
      properties:
        digests:
          type: array
          items:
            $ref: "#/components/schemas/Digest"
```

## 応答の例

`GET /digests/published?before=2026-10-25&limit=2`

```json
{
  "digests": [
    { "id": "…", "entryDate": "2026-10-22", "status": "published", "articles": [ … ] },
    { "id": "…", "entryDate": "2026-10-20", "status": "published", "articles": [ … ] }
  ]
}
```

## router テスト (`backend/cmd/server/main_test.go`)

| 表 | 行 | 守るもの |
|---|---|---|
| `TestRouter` | `{"GET", "/digests/published", "", 401, api.Problemsunauthorized}` | FR-009 (未ログインは拒否) |
