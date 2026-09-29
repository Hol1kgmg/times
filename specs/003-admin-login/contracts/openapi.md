# Contract: backend OpenAPI 追加分

`backend/api/openapi.yaml` に追加する断片。実装時にこの内容をそのまま書き、`just be-gen` で `internal/api/gen.go` と `frontend/src/shared/api/openapi.gen.ts` を再生成する。

## securitySchemes と照合の規則

```yaml
components:
  securitySchemes:
    # 管理者の session トークン (adr/backend/0007)。frontend のサーバー関数が Cookie から転送する
    bearerAuth:
      type: http
      scheme: bearer
```

- `security: [{ bearerAuth: [] }]` を付けた操作だけ、`newRouter` の `AuthenticationFunc` がトークンを照合する。付いていない操作は照合しない (`/health`, `/items*`, `/digests/latest`)
- 照合失敗は 401 `/problems/unauthorized` (Problem Details)。既存の `X-Backend-Token` 失敗と同じ `type` だが、`detail` で区別する (`"missing or invalid bearer token"`)
- グローバル `security` は置かない。管理者専用の操作に個別に付ける

## paths

```yaml
paths:
  /auth/sessions:
    post:
      operationId: createSession
      summary: GitHub の code を検証し、管理者の session を発行する
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NewSession"
      responses:
        "201":
          description: Created。token はこの応答にだけ現れる
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreatedSession"
        "400":
          $ref: "#/components/responses/BadRequest"
        "403":
          description: 許可されていない GitHub アカウント、または backend の GitHub 連携が未設定
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
        "502":
          description: GitHub との通信・応答の検証に失敗 (code が無効な場合も含む)
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
  /auth/sessions/current:
    get:
      operationId: getCurrentSession
      summary: Bearer の session を照合し、管理者を返す
      security:
        - bearerAuth: []
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Session"
        "401":
          $ref: "#/components/responses/Unauthorized"
    delete:
      operationId: deleteCurrentSession
      summary: Bearer の session を削除する (ログアウト)。存在しなくても 204
      security:
        - bearerAuth: []
      responses:
        "204":
          description: No Content
        "401":
          $ref: "#/components/responses/Unauthorized"
```

`DELETE` の冪等性: Bearer が形式として有効で照合に失敗した場合は 401 だが、frontend は 401 も成功と同じに扱い Cookie を消す (spec Edge Case: 2 回連続のログアウト)。

## schemas

```yaml
components:
  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/Problem"
  schemas:
    NewSession:
      type: object
      required: [code, redirectUri]
      properties:
        code:
          type: string
          minLength: 1
          maxLength: 200
          description: GitHub authorize から戻った code
        redirectUri:
          type: string
          format: uri
          description: authorize に渡した redirect_uri。token 交換で GitHub が一致を検証する
    AdminUser:
      type: object
      required: [id, login]
      properties:
        id:
          type: integer
          format: int64
          description: GitHub 固定 ID。サービス内で管理者を指す識別子
        login:
          type: string
    Session:
      type: object
      required: [user, expiresAt]
      properties:
        user:
          $ref: "#/components/schemas/AdminUser"
        expiresAt:
          type: string
          format: date-time
    CreatedSession:
      allOf:
        - $ref: "#/components/schemas/Session"
        - type: object
          required: [token]
          properties:
            token:
              type: string
              description: 不透明トークン。Cookie に入れて Bearer で転送する
    Problem:
      properties:
        type:
          enum:
            - about:blank
            - /problems/validation-failed
            - /problems/not-found
            - /problems/unauthorized
            - /problems/forbidden          # 追加
            - /problems/upstream-failed    # 追加
```

`apperr.Types` に `/problems/forbidden: 403` と `/problems/upstream-failed: 502` を足す。既存テスト `TestProblemTypesMatchSpec` が enum との一致を検証する。

## handler の契約

| 操作 | 入力 | 処理 | 出力 |
|---|---|---|---|
| `CreateSession` | `code`, `redirectUri` | 設定未完 → 403。GitHub token 交換 → `GET /user` (失敗 → 502)。`login` 不一致 → 403 (何も保存しない)。一致 → `UpsertUser`、`DeleteExpiredSessions`、トークン生成、`CreateSession` | 201 `{ token, user, expiresAt }` |
| `GetCurrentSession` | context の user / session | なし | 200 `{ user, expiresAt }` |
| `DeleteCurrentSession` | context の token hash | `DeleteSessionByTokenHash` | 204 |

`AuthenticationFunc` は `Authorization: Bearer <token>` を取り、`sha256` → `GetSessionByTokenHash` → 見つからなければ `apperr.Unauthorized`。見つかれば `{ user, session }` を request context に載せる。

## GitHub との HTTP (backend のみ)

| 呼び出し | 要求 | 期待する応答 |
|---|---|---|
| token 交換 | `POST {GITHUB_BASE_URL}/login/oauth/access_token`、`Accept: application/json`、form または JSON `{ client_id, client_secret, code, redirect_uri }` | `{ access_token }`。`error` フィールドがあれば 502 |
| ユーザー取得 | `GET {GITHUB_API_URL}/user`、`Authorization: Bearer <access_token>`、`User-Agent: times-backend` | `{ id: int64, login: string }` |

タイムアウトは `http.Client{ Timeout: 10 * time.Second }`。
