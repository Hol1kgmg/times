---
status: 'accepted'
date: 2026-11-05
decision-makers: 'Hol1kgmg'
---

# リンクプレビューの HTML は正規表現のまま読み、HTMLRewriter への移行は CPU 時間の上限に当たるまで見送る

## Context and Problem Statement

リンクプレビューは Workers で外部ページを `fetch` し、`</head>` までを正規表現で読んで og タグを取っていた。Next.js (App Router、15.2 以降) はボットと判定しない UA に og タグを `</head>` より後ろの body へ流すため、取得に失敗していた (issue #77、`aquavoice.com/ja/vs/typeless`)。

直すには `</head>` を過ぎても読み進める必要があり、og タグのないページでは最大 1MB を読んで正規表現にかけることになる。HTML の読み方として 3 案を比べた。

- **正規表現のまま読み進める**: 文字列を受けて結果を返す純粋関数のままで、Vitest (jsdom) でテストできる
- **`DOMParser`**: Workers にはない。linkedom などを入れても DOM の木を丸ごと作るので、正規表現より CPU 時間もメモリも食い、途中で読むのをやめられない
- **`HTMLRewriter`**: Workers に組み込みのストリーミングパーサー (lol-html)。木を作らず、セレクターで要素を拾える。ただし Node で動く Vitest にはない

## Decision

**正規表現のまま、`</head>` までに og タグが見つからないときだけ 1MB まで読み進める。`HTMLRewriter` には移さない。**

- 今成功しているページ (head に og タグがある) の読む量と CPU 時間は変わらず、増えるのは今失敗しているページの分だけ
- 結果は 24 時間 (失敗は 1 時間) キャッシュされるので、読む量が増えても URL ごとに 1 日 1 回程度
- `HTMLRewriter` をテストするには `@cloudflare/vitest-plugin` で workerd の中でテストを動かす必要がある。このプラグインは独自の `environment` に対応しておらず、jsdom で動いている UI のテストと同じ設定に置けない。Vitest の projects で設定を 2 つに分けることになり、この修正 1 つのためには重い

## Consequences

- Good, because 依存もテストの設定も増えず、`parseLinkPreview` のテストはそのまま使える
- Bad, because og タグのないページでは、最大 1MB の文字列に正規表現をかける。Workers の CPU 時間の上限 (無料プランで 10ms) に当たるかは計測していない

## Implementation Plan

- **Affected paths**: `frontend/src/shared/api/link-preview.server.ts`

### Verification

- [x] `</head>` の後ろに og タグがある HTML から og:title が取れる (`link-preview.server.test.ts`)

## Revisit

リンクプレビューで Workers の CPU 時間の上限 (`exceededCpu`) が出たら、この ADR を supersede して `HTMLRewriter` に移す。そのとき `@cloudflare/vitest-plugin` を入れ、Vitest の projects でサーバー側のテストを workerd に分ける。
