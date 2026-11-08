# Research: 記事のカテゴリを AI で推定して振り分ける

## R1. 推定に使うモデル

- **Decision**: Workers AI の `@cf/cloudflare/clef` (`model: "clef"`) に、`choice` 型の質問を 1 つ投げる。`criteria` は `category.options` から作る (6 件。clef の上限は 2〜255 件)。
- **Rationale**: issue #86 の指定。`choice` は与えた選択肢から 1 つ選び、選択肢ごとの確率を返す。自由文を生成させてパースする必要がない。出力 token は課金されない。
- **Alternatives considered**: テキスト生成モデルに JSON で答えさせる案。選択肢の外の文字列や崩れた JSON を返し得るので、却下した。

答えの形 (公式の schema-output.json):

```json
{ "type": "choice", "choice": "<最上位の選択肢>", "probabilities": { "<選択肢>": 0.0 }, "confidence": 0.0 }
```

## R2. しきい値

- **Decision**: `probabilities[choice] >= 0.5` のときだけカテゴリを返し、それ以外は `null` にする。`choice` が `category` に含まれないときも `null` にする。
- **Rationale**: 6 択で過半の確率なら、ほかのどれよりも確からしい。`confidence` は「確率から導いた値」とだけ書かれ、定義が明らかでないので使わない。
- **Alternatives considered**: `confidence` を使う案。定義が不明なので、しきい値の意味を説明できない。

## R3. サーバー関数から AI binding を取る方法

- **Decision**: `*.server.ts` の中で `await import("cloudflare:workers")` を動的に呼び、`env.AI` を取る。`vite.config.ts` で ssr 環境の `cloudflare:*` を external にする。import に失敗したとき (ローカルの Node) と `env.AI` が無いときは `null` を返す。
- **Rationale**: 確認したところ、external を付けないと `vite build` が `Rolldown failed to resolve import "cloudflare:workers"` で落ちる。`environments.ssr.build.rollupOptions.external: [/^cloudflare:/u]` を付けると、ビルドが通り、`dist/server` に `await import("cloudflare:workers")` がそのまま残る。Workers の実行時はこれで解決される。ローカル開発 (`vite dev`) で import が解決されずに失敗する点は、方針 A の「推定しない」に当たる。spec の「無視してよいエラー」の条件 (原因が分かっていて、失敗しても仕様を満たす) に合うので、ここに限って握りつぶし、理由を 1 行コメントで残す。
- **実装時の確認事項**: `vite dev` でモジュールの変換の段階で落ちないか (落ちる場合は ssr 環境の `resolve.external` に変える)。
- **Alternatives considered**:
  - `@cloudflare/vite-plugin` を入れて dev も workerd で動かす案。dev の実行基盤が変わり、影響範囲が大きい。方針 A で却下した。
  - REST API (`/accounts/{id}/ai/run`) をトークンで呼ぶ案。シークレットが増える。方針 B として却下した。

## R4. 型

- **Decision**: `cloudflare-workers.d.ts` で `declare module "cloudflare:workers" { export const env: Record<string, unknown>; }` だけを宣言する。`env.AI` は「`run(model, input): Promise<unknown>` を持つか」をその場で確かめてから使い、返り値は Zod で検証する。
- **Rationale**: `@cloudflare/workers-types` を入れると、グローバルの型 (`Response` など) が DOM の型と衝突し得る。使うのは 1 メソッドだけなので、宣言は最小で足りる (原則 IV)。
- **Alternatives considered**: `wrangler types` で生成する案。生成物と、その更新の手順が増える。

## R5. 推定の印を外す契機

- **Decision**: 箱を移す操作 (`moveToBoxEnd` と、ドラッグの `fromIds` で箱が変わったとき) で `suggested` を `false` にする。同じ箱の中での並び替えでは残す。
- **Rationale**: spec の US2 のシナリオ 3 と 4。
- **Alternatives considered**: 登録するまで印を残す案。手で決めた候補と、確かめていない推定を見分けられなくなる。

## R6. 呼ぶタイミング

- **Decision**: `url-add-form` で `settleTitle` の後、`setAdding(false)` の後に呼ぶ。失敗は `catch` して、未分類のまま残す。
- **Rationale**: タイトルがあるほうが推定が正確になる。入力欄はタイトルの取得の後に戻すので、推定を待つ間も次の URL を入れられる。
