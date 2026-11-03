# Contract: openapi.yaml の差分

## paths

```yaml
  /articles/domains:
    get:
      operationId: listArticleDomains
      description: 公開の Digest の記事の URL のドメインを、記事の件数の多い順に返す。ログインユーザーなら誰でも使える (今ログインできるのは管理者だけ)
      security:
        - bearerAuth: []
      parameters:
        - $ref: "#/components/parameters/DomainQuery"
        - $ref: "#/components/parameters/DomainLimit"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DomainList"
        "400":
          description: 形式違反 (validation-failed)
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
        "401":
          $ref: "#/components/responses/Unauthorized"
  /articles/domains/all:
    get:
      operationId: listAllArticleDomains
      description: 登録済みの記事の URL のドメインを、Digest のステータスを問わず記事の件数の多い順に返す。管理者専用
      security:
        - bearerAuth: []
      parameters:
        - $ref: "#/components/parameters/DomainQuery"
        - $ref: "#/components/parameters/DomainLimit"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DomainList"
        "400":
          description: 形式違反 (validation-failed)
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
        "401":
          $ref: "#/components/responses/Unauthorized"
```

## components/parameters

2 つの操作で同じ境界を使うので、`components/parameters` に 1 度だけ書く。

```yaml
  parameters:
    DomainQuery:
      name: q
      in: query
      description: ドメインに含まれる文字列。大文字小文字を区別しない
      schema:
        type: string
        maxLength: 100
    DomainLimit:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 50
        default: 20
```

## components/schemas

```yaml
    DomainList:
      type: object
      required: [domains]
      properties:
        domains:
          type: array
          items:
            $ref: "#/components/schemas/DomainCount"
    DomainCount:
      type: object
      required: [host, count]
      properties:
        host:
          type: string
          minLength: 1
        count:
          type: integer
          minimum: 1
```

## 応答の例

`GET /articles/domains?q=zen&limit=5`

```json
{ "domains": [{ "host": "zenn.dev", "count": 3 }] }
```

## router テスト (`backend/cmd/server/main_test.go`)

| 表 | 行 | 守るもの |
|---|---|---|
| `TestRouter` | `{"GET", "/articles/domains", "", 401, api.Problemsunauthorized}` | FR-011 (公開分も未ログインは拒否) |
| `TestRouter` | `{"GET", "/articles/domains/all", "", 401, api.Problemsunauthorized}` | FR-007 (全件は未ログインは拒否) |
| `TestBearerAuth` | `{"GET", "/articles/domains?limit=51", "Bearer valid", 400, true}` | FR-004 (範囲外は形式違反、認証の後に検証) |
