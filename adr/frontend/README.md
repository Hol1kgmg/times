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
| 0009 | [今の体験を保てる部品は React Aria Components に置き換え、保てないものは自前のまま残す](0009-replace-components-with-rac-where-ux-is-kept.md) | accepted |
| 0010 | [リンクプレビューの HTML は正規表現のまま読み、HTMLRewriter への移行は CPU 時間の上限に当たるまで見送る](0010-keep-regex-link-preview-parser-defer-htmlrewriter.md) | accepted |
| 0011 | [記事のカテゴリは Workers AI の clef で推定し、ローカル開発では推定しない](0011-suggest-category-with-workers-ai-clef.md) | accepted |
| 0012 | [記事タイトルは clef の noul で固有名称を決め、Cloud Translation v2 で翻訳する](0012-translate-titles-with-clef-noul-and-translation-v2.md) | accepted |
| 0013 | [閲覧者の権限は `kind` の文字列ではなく、照合で作るブランド型の値で表す](0013-represent-viewer-privileges-as-branded-values.md) | accepted |
| 0014 | [WebMCP は画面の状態をサイトが決めた操作として渡すために使い、トップの行き先の案内から試験導入する](0014-use-webmcp-for-site-defined-page-operations.md) | accepted |
