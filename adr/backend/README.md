# ADR — backend の決定

`backend/` に関する決定。規約は [from-template/README.md](../from-template/README.md) と同じ。

## ADRs

| # | ADR | status |
|---|---|---|
| 0001 | [HTTP framework に Gin を採用し、oapi-codegen strict-server の下に隠す](0001-adopt-gin-behind-oapi-codegen-strict-server.md) | accepted |
| 0002 | [エラーは RFC 9457 Problem Details で返し、ドメインエラーは Go の error で表現する](0002-return-errors-as-rfc9457-problem-details.md) | accepted |
