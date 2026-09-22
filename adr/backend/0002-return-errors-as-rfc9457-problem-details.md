---
status: 'accepted'
date: 2026-09-22
decision-makers: 'Hol1kgmg'
---

# エラーは RFC 9457 Problem Details で返し、ドメインエラーは Go の error で表現する

## Context and Problem Statement

現状のエラー応答は次の3経路があり、形も意味も揃っていない。

| 経路 | 場所 | 応答 |
|---|---|---|
| spec 違反（必須欠落、`minLength` 等） | `OapiRequestValidator` の `ErrorHandler` | 400 + `{"message": ...}` |
| JSON デコード失敗 | `RequestErrorHandlerFunc` | 400 + `{"message": ...}` |
| handler が返した `error` | `ResponseErrorHandlerFunc` | 常に 500 + `{"message": "internal server error"}` |

問題は2つある。

1. **handler が想定内の失敗を表現できない。** 「存在しない id」「重複」を返す手段が無く、`error` を返すと 500 に潰れる
2. **クライアントが機械的に分岐できない。** `Error` スキーマは `message`（人間向け文字列）しか持たない。status code だけでは同じ 400 の中の区別がつかない

[ADR 0001](0001-adopt-gin-behind-oapi-codegen-strict-server.md) により handler は framework を触らないので、エラーの変換は `cmd/server/main.go` の配線層に集約する必要がある。

strict-server には想定内の失敗を型付きレスポンス（`CreateItem404JSONResponse` 等）で返す道もある。これはコンパイラが「この操作はこの status しか返せない」を保証する反面、handler ごとに Problem Details の組み立てを繰り返すことになる。本 ADR では **一貫した形を1か所で作ること** を優先し、型による強制は採らない。

## Decision

### 1. エラー応答の形は RFC 9457 Problem Details

全てのエラー応答は `Content-Type: application/problem+json` で、次の形を返す。

```json
{
  "type": "/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "item 3f2a... does not exist"
}
```

- `type`: エラー種別を表す相対 URI。クライアントはこれで分岐する。解決できる URL である必要は無い（RFC 9457 §3.1.1）。想定外のエラーは `about:blank`
- `title`: `type` に対して固定の短い文言。status の reason phrase と同じでよい
- `status`: HTTP status code と同値
- `detail`: この発生に固有の説明。省略可。**500 では出さない**（内部情報を漏らさないため）
- `instance` と拡張メンバは使わない

### 2. handler は想定内の失敗も Go の `error` で返す

`internal/apperr` パッケージにエラー型を1つ置く。

```go
type Error struct {
    Status int
    Type   string // "/problems/not-found" 等
    Detail string
}
func (e *Error) Error() string

func NotFound(detail string) error   // 404, /problems/not-found
func Conflict(detail string) error   // 409, /problems/conflict
```

- `Title` は持たない。`title` は status の reason phrase と決めているので、`writeProblem` が `http.StatusText(status)` で導出する

- handler は `return nil, apperr.NotFound("item " + id + " does not exist")` のように返す
- DB 由来のエラー（`pgx.ErrNoRows` 等）は **handler が** `apperr` に変換する。配線層は DB を知らない
- `apperr.Error` でない `error` は想定外として扱い、500 にする

### 3. 変換は `newRouter` の `writeProblem` 1関数で行う

oapi-codegen が用意するエラーフックは5つあり、全てを `writeProblem` に集める。

| フック | 発生源 | 応答 |
|---|---|---|
| `OapiRequestValidator.ErrorHandler` | spec 違反（必須欠落、`minLength` 等） | 400 `/problems/validation-failed` |
| `GinServerOptions.ErrorHandler` | パスパラメータの形式違反（uuid でない等） | 400 `/problems/validation-failed` |
| `StrictGinServerOptions.RequestErrorHandlerFunc` | JSON デコード失敗 | 400 `/problems/validation-failed` |
| `StrictGinServerOptions.HandlerErrorFunc` | handler が返した `error` | `apperr` なら `Status`/`Type`、それ以外は 500 `about:blank` |
| `StrictGinServerOptions.ResponseErrorHandlerFunc` | レスポンス書き出し失敗 | 500 `about:blank` |

- `writeProblem` は `errors.As` で `*apperr.Error` を取り出せれば `Status` と `Type` で Problem Details を返す。取り出せなければ `slog` に出して `about:blank` の 500 を返す
- Gin の `c.JSON` は `Content-Type` を `application/json` に固定するので、`c.Data(status, "application/problem+json", body)` で書く

### 4. OpenAPI には返しうる status を宣言する

- `components.schemas.Error` を `Problem` に置き換える。`type` は `enum` にし、`/problems/*` の一覧を spec 側で管理する
- 各操作の `responses` に返しうる status を `application/problem+json` で宣言する。宣言と実装の一致はコンパイラでは担保されないので、テストで担保する（Verification 参照）

**Non-goals**

- 型付きレスポンス（`CreateItem404JSONResponse`）による強制。上記の理由で採らない。再検討条件は More Information を参照
- 独自エラーコード体系。`type` URI で代替する
- メッセージの i18n。`title` と `detail` は英語固定
- `/problems/*` を実際に解決できるドキュメント URL にすること

## Consequences

- Good, because handler が1行で想定内の失敗を返せる。Problem Details の組み立てを handler ごとに繰り返さない
- Good, because クライアントは `type` で分岐でき、フロントの生成型にも `enum` として伝わる
- Good, because 3経路のエラーが同じ形になる。クライアントのエラー処理が1本になる
- Bad, because **handler が spec に宣言していない status を返せてしまう。** `apperr.NotFound` を返す操作の spec に 404 が無くてもコンパイルは通る。テストで検出する
- Bad, because `apperr` の関数を増やすたびに spec の `type` enum も更新する必要がある。二重管理になる
- Bad, because 既存の `Error` スキーマと `{"message": ...}` 応答は消える。現時点でクライアントは無いので移行コストはゼロ

## Implementation Plan

- **Affected paths**:
  - `backend/api/openapi.yaml`: `Error` → `Problem`、各操作に `application/problem+json` の responses を追加
  - `backend/internal/apperr/apperr.go`（新規）: `Error` 型とコンストラクタ
  - `backend/cmd/server/main.go`: `newRouter` の3つのエラーハンドラを Problem Details 化
  - `backend/internal/handler/handler.go`: `GetItem` で `pgx.ErrNoRows` を `apperr.NotFound` に変換する。以降の handler はこれに倣う
  - `backend/db/queries/items.sql`、`backend/api/openapi.yaml`: `GetItem` を最初の実例として追加
  - `backend/cmd/server/main_test.go`: `Content-Type` と body 形の検証、spec enum と `apperr.Types` の突き合わせ
- **Dependencies**: 追加なし。`encoding/json`、`errors`、`log/slog` で足りる
- **Patterns to follow**:
  - エラー変換の配置は [ADR 0001](0001-adopt-gin-behind-oapi-codegen-strict-server.md) の「framework に触る処理は `newRouter` に集約」に従う
  - `apperr` のコンストラクタは `NotFound(detail string) error` の形。戻り値は `error` インターフェースにして、呼び出し側が `*apperr.Error` を意識しないようにする
  - 500 のログは `slog.Error("handler error", "err", err, "method", c.Request.Method, "path", c.Request.URL.Path)` の形で、リクエストの特定に必要な情報を付ける
- **Patterns to avoid**:
  - `ResponseErrorHandlerFunc` で `pgx.ErrNoRows` を直接 404 に変換する（配線層が DB の意味を知ることになる。変換は handler で行う）
  - handler で `apperr.Error{Status: 418, ...}` のようにコンストラクタを経由せず組み立てる（`type` の一覧が spec と乖離する）
  - 500 の `detail` に `err.Error()` を入れる
  - `c.JSON` で Problem Details を返す（`Content-Type` が `application/json` になる）

### Verification

- [x] `POST /items` に `{"title":""}` を送ると 400、`Content-Type: application/problem+json`、`type` が `/problems/validation-failed`（`TestRouter`）
- [x] `POST /items` に不正な JSON を送ると 400、同上（`TestRouter`）
- [x] `GET /items/not-a-uuid` が 400、同上（`TestRouter`）
- [x] `apperr.NotFound` を返すスタブ handler を `newRouter` に通すと 404、`type` が `/problems/not-found`、`detail` にコンストラクタへ渡した文字列（`TestRouter`）
- [x] `errors.New("boom")` を返すスタブ handler を通すと 500、`type` が `about:blank`、body に `boom` が含まれない（`TestUnexpectedError`）
- [x] `openapi.yaml` の `Problem.type` enum と `apperr.Types` の集合が一致する（`TestProblemTypesMatchSpec`）
- [x] `go test ./...` が通る（2026-09-22）

## Alternatives Considered

- **型付きレスポンスで想定内の失敗を返す**: `CreateItem404JSONResponse` を返せば spec との一致をコンパイラが保証する。しかし Problem Details の組み立て（`title`、`status` の重複記入）を handler ごとに繰り返し、`Content-Type` を `application/problem+json` にするには生成コードの `ContentType` 指定にも気を配る必要がある。一貫性を1か所で作れる方を取った
- **`{"code": "...", "message": "..."}` の独自形**: 最小構成で済むが、`status` の重複や `detail` の扱いを自前で決めることになる。RFC 9457 は同じことを標準の名前で定義しているので、独自形にする理由が無い
- **配線層で `pgx.ErrNoRows` を 404 に変換する**: handler が短くなるが、「行が無い」が常に 404 とは限らない（`UPDATE ... RETURNING` で 0 行なら 404 だが、`INSERT ... ON CONFLICT DO NOTHING RETURNING` で 0 行なら 409）。変換は文脈を知る handler で行う

## More Information

- 関連: [HTTP framework に Gin を採用し、oapi-codegen strict-server の下に隠す](0001-adopt-gin-behind-oapi-codegen-strict-server.md)
- RFC 9457 Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457
- 再検討条件: 「spec に無い status を返している」バグがテストをすり抜けて本番で見つかったら、型付きレスポンスへの切り替えを検討する。その場合も応答の形（Problem Details）は変えない
