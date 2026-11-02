# ADR — frontend の決定

`frontend/` に関する決定。規約は [from-template/README.md](../from-template/README.md) と同じ。

## ADRs

| # | ADR | status |
|---|---|---|
| 0001 | [API の型は openapi-typescript で生成し、zod スキーマは手書きしてブランド型で縛る](0001-generate-api-types-and-hand-write-branded-zod-schemas.md) | accepted |
| 0002 | [backend の読み取り結果とリンクプレビューは Workers の Cache API に載せ、backend にはキャッシュを置かない](0002-cache-backend-reads-in-workers-cache-api.md) | accepted |
| 0003 | [Slack のチャンネルの構造を借り、色は独自のネイビー 1 色にする](0003-borrow-slack-channel-structure-with-own-colors.md) | accepted |
| 0004 | [ロゴは「フィードで組んだ z + 新着ドット」で作り、形の正はコードに置く](0004-build-logo-from-feed-bars-z-and-new-dot.md) | accepted |
| 0005 | [固定の UI 文字は Klee One のサブセットを preload して先に出し、記事タイトルの遅れは許容する](0005-preload-klee-one-subset-for-fixed-ui-text.md) | accepted |
| 0006 | [記事プレビューの待ち時間と Esc での消去は CSS と小さな JS で作り、interestfor はまだ使わない](0006-delay-and-dismiss-link-preview-without-interestfor.md) | accepted |
| 0007 | [ホバーのきっかけは react-aria の useHover で操作ごとに判定し、ホバー前提の UI を出すかはメディアクエリで決める](0007-split-hover-trigger-and-hover-ui-presence.md) | accepted |
| 0008 | [ヘッドレス UI は React Aria Components を採用し、日付ピッカーの月表示から置き換える](0008-adopt-react-aria-components-starting-with-date-picker.md) | accepted |
