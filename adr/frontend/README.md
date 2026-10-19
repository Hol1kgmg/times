# ADR — frontend の決定

`frontend/` に関する決定。規約は [from-template/README.md](../from-template/README.md) と同じ。

## ADRs

| # | ADR | status |
|---|---|---|
| 0001 | [API の型は openapi-typescript で生成し、zod スキーマは手書きしてブランド型で縛る](0001-generate-api-types-and-hand-write-branded-zod-schemas.md) | accepted |
| 0002 | [backend の読み取り結果とリンクプレビューは Workers の Cache API に載せ、backend にはキャッシュを置かない](0002-cache-backend-reads-in-workers-cache-api.md) | accepted |
| 0004 | [ロゴは「フィードで組んだ z + 新着ドット」で作り、形の正はコードに置く](0004-build-logo-from-feed-bars-z-and-new-dot.md) | accepted |
