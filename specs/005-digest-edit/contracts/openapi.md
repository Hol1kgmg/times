# Contract: openapi.yaml の差分

## paths

```yaml
  /digests:
    get:
      operationId: listDigests
      summary: 登録済みの Digest の日付を新しい順に返す。記事は含まない
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DigestList"
    post: # 既存 (createDigest) のまま

  /digests/{entryDate}:
    parameters:
      - { name: entryDate, in: path, required: true, schema: { type: string, format: date } }
    get:
      operationId: getDigestByDate
      responses:
        "200": Digest
        "400": 形式違反 (validation-failed)
        "404": その日付の Digest がない (not-found)
    put:
      operationId: updateDigest
      summary: その日付の Digest の日付と記事一式を置き換える。日付を変えるときは body の entryDate に新しい日付を入れる
      security:
        - bearerAuth: []
      requestBody: NewDigest (createDigest と同じ)
      responses:
        "200": Digest
        "400": 形式違反 (validation-failed)、変更先の日付に別の Digest が登録済み (digest-already-exists)、他の Digest で登録済みの URL を含む (url-already-registered、duplicateUrls 付き)。両方ぶつかるときは digest-already-exists
        "401": Unauthorized
        "404": 自分の Digest にその日付のものがない (not-found)
```

更新のキーを `id` ではなく日付にする: gin は同じ位置に名前の違うパスパラメーター (`:entryDate` と `:id`) を置くと起動時に panic する。日付は管理者ごとに一意 (`digests_created_by_entry_date_key`) なので、キーとして足りる。`/digests/latest` は静的な経路として `:entryDate` より優先される (research R6)。

## components/schemas

```yaml
    DigestList:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: "#/components/schemas/DigestSummary"
    DigestSummary:
      type: object
      required: [id, entryDate]
      properties:
        id: { type: string, format: uuid }
        entryDate: { type: string, format: date }
```

`Problem.type` の enum は増やさない (既存の 5 + 2 種で足りる)。

## router テスト (`cmd/server/main_test.go` の表に 1 操作 1 行)

| 操作 | 行 |
|---|---|
| listDigests | stub で空を返し 200 |
| getDigestByDate | `GET /digests/not-a-date` → 400 `validation-failed` |
| updateDigest | 認証なしの `PUT /digests/2026-10-17` → 401 `unauthorized` (認証が body 検証より先) |
