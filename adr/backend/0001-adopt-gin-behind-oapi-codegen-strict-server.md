---
status: 'accepted'
date: 2026-09-22
decision-makers: 'Hol1kgmg'
---

# HTTP framework に Gin を採用し、oapi-codegen strict-server の下に隠す

## Context and Problem Statement

backend 導入時（コミット `3f051ed`）に HTTP framework として Gin を選んだが、Echo との比較検討を経ていない。items の CRUD を増やす前に、framework の位置づけを固定しておきたい。

現行の構成は次のとおり。

- `backend/api/openapi.yaml` が API の source of truth。`oapi-codegen` が `strict-server: true` で `internal/api/gen.go` を生成する
- handler（`internal/handler/`）は生成された `api.StrictServerInterface` を実装する。引数はリクエスト型、戻り値はレスポンス型と `error` で、`gin.Context` は受け取らない
- リクエストの検証は `oapi-codegen/gin-middleware` の `OapiRequestValidator` が spec に基づいて行う。JSON のバインドは生成コードが行う
- framework 固有のコードは `cmd/server/main.go` の `newRouter` 約20行だけ

この構成では、Gin / Echo / net/http の差が出る場所（Context API、バリデータ、エラー処理の流儀）が handler から消えている。framework 選定の論点は「handler をどう書くか」ではなく「配線の20行を何で書くか」に縮んでいる。

## Decision

Gin を維持する。ただし **framework は `cmd/server/main.go` の配線に閉じ込め、handler からは見えないようにする**。

- handler は `api.StrictServerInterface` の実装だけを持つ。`gin.Context` を引数にとる関数を `internal/handler/` に置かない
- middleware は `newRouter` で登録する。ロギング、リクエスト検証、エラー変換はここに集約する
- `oapi-codegen.yaml` の `gin-server: true` と `strict-server: true` を維持する

**Non-goals**

- Echo 同梱 middleware（CORS、JWT、rate limit 等）の再現。必要になったときに `gin-contrib` から個別に足す
- net/http（`std-http-server`）への移行。再検討条件は More Information を参照
- Gin の性能・機能を活かした最適化。framework は隠すものであり、活かすものではない

## Consequences

- Good, because handler が framework に依存しないので、テストは `StrictServerInterface` のメソッドを直接呼ぶだけで書ける
- Good, because framework の乗り換えコストが `oapi-codegen.yaml` 1行と `main.go` 約20行に固定される。決定を誤っても取り返しがつく
- Good, because 導入済みの構成をそのまま使えるので、追加作業が無い
- Bad, because strict-server で表現できない要件（streaming レスポンス、SSE、WebSocket）が出たとき、この方針のままでは書けない。そのときは再検討条件に従う
- Bad, because Gin の間接依存（`bytedance/sonic`、`goccy/go-json` 等）がビルドに含まれる。net/http なら不要な重さ。現時点では受け入れる

## Implementation Plan

現行コードが既にこの決定に従っているため、新規実装は不要。以降のコードが守るべき規約として書く。

- **Affected paths**: `backend/cmd/server/main.go`（配線）、`backend/api/oapi-codegen.yaml`（生成設定）、`backend/internal/handler/`（framework 非依存を維持する）
- **Dependencies**: `github.com/gin-gonic/gin` v1.12、`github.com/oapi-codegen/gin-middleware` v1.1（導入済み。追加・削除なし）
- **Patterns to follow**:
  - 新しいエンドポイントは `openapi.yaml` に書き、`oapi-codegen` で生成し、`internal/handler/` に `StrictServerInterface` のメソッドとして実装する（`handler.go` の `CreateItem` と同じ形）
  - framework に触る必要がある処理（middleware、エラー変換）は `main.go` の `newRouter` に足す
  - ルーティングのテストは `cmd/server/main_test.go` の `TestRouter` と同じく `httptest` で `newRouter` を叩く
- **Patterns to avoid**:
  - `internal/handler/` で `gin` を import する
  - `r.GET(...)` のように spec を経由せずルートを直接登録する
  - handler 内で status code や JSON を手書きする（生成されたレスポンス型を使う）

### Verification

- [x] `grep -rl gin-gonic backend/internal/ --exclude-dir=api` が何も返さない（`internal/api/gen.go` は生成コードなので除外）
- [x] `backend/cmd/server/` と `backend/internal/api/gen.go` 以外に `gin` の import が存在しない
- [x] `oapi-codegen.yaml` に `gin-server: true` と `strict-server: true` がある
- [x] `go test ./...` が通る（2026-09-22）

## Alternatives Considered

- **Echo**: `oapi-codegen` の `echo-server` と `echo-middleware` で同等の構成が組める。差は本体同梱 middleware の多さと間接依存の軽さだけで、strict-server 配下の handler には現れない。既に Gin で動いているものを置き換える対価に見合わない
- **net/http（`std-http-server`）**: Go 1.22 以降は method + path のルーティングが標準にあり、`oapi-codegen/nethttp-middleware` で検証もできる。framework 依存をゼロにできる唯一の選択肢。失うのは `gin.Default()` の logger と recovery で、`slog` と `recover` の数行で代替できる。今は乗り換えの動機が無いが、依存を減らしたくなったときの移行先は Echo ではなくこれ

## More Information

- 関連: [エラーは RFC 9457 Problem Details で返す](0002-return-errors-as-rfc9457-problem-details.md)（エラー変換を `newRouter` に集約する根拠）
- 再検討条件: strict-server で表現できない要件（streaming、SSE、WebSocket）が出て、handler で `gin.Context` を触りたくなったとき。その場合は該当エンドポイントだけを `newRouter` で直接登録するか、net/http への全面移行を検討する。Echo への移行は候補に含めない
