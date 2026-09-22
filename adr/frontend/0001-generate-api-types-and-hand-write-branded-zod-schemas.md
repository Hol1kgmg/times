---
status: 'accepted'
date: 2026-09-22
decision-makers: 'Hol1kgmg'
---

# API の型は openapi-typescript で生成し、zod スキーマは手書きしてブランド型で縛る

## Context and Problem Statement

[backend/0003](../backend/0003-call-backend-from-server-functions-only.md) で「API の型は `backend/api/openapi.yaml` から生成し、`frontend/src/shared/api/` に置く」と決めた。実際に繋ぐにあたり、次の 2 点を決める必要がある。

1. **型の生成手段と、生成物をいつ更新するか**。手動生成だと openapi.yaml と型が乖離したまま commit される
2. **実行時検証をどう持つか**。TypeScript の型は JSON レスポンスを検証しない。frontend は既に zod を持ち、サーバー関数の入力を `.validator(z.object(...))` で検証している。レスポンスにも同じ zod を使うが、そのスキーマを手で書くか生成するか

さらに、id の取り違え（`Item` の id を `Digest` の取得に渡す等）を typecheck で落としたい。これには zod の `.brand<>()` が要る。

## Decision

- **型は `openapi-typescript` で生成する**。出力は `frontend/src/shared/api/openapi.gen.ts`。`routeTree.gen.ts` と同じく gitignore し、commit しない
- **生成は 4 経路で走る**。`pnpm install` の `postinstall`（clone 直後に typecheck が通るように）、lefthook pre-commit の `typecheck`（生成してから検査するので、古い型のまま commit されない）、GitHub Actions の `frontend-ci`（`generate-routes` と並べて typecheck / lint / test の前に明示的に生成する）、`just be-gen`（Go 側と一緒に手動）
- **commit しない根拠**: このファイルは型だけで、`index.ts` から `export type` で参照する。vite build と vitest は型を消すので、tsc とエディタにしか要らない。生成ツールは devDependency なので install 済みの環境なら必ず生成できる。backend の `gen.go` を commit しているのは、生成に `oapi-codegen` の別途インストールが要るためで、事情が異なる
- **zod スキーマは `frontend/src/shared/api/schemas.ts` に手書きする**。各スキーマは `satisfies z.ZodType<components["schemas"]["X"]>` で生成型に縛り、openapi.yaml と乖離したら typecheck で落ちるようにする
- **entity の id は `z.string().uuid().brand<"ItemId">()` の形でブランド化する**。export する型は `z.infer` 側（ブランド付き）で、生成型の `components["schemas"]["X"]` は `satisfies` の右辺にだけ使う
- **ブランドは id にだけ付ける**。レスポンス object 全体にはブランドを付けない（`Pick` や spread で剥がれ、扱いにくいだけで守れる範囲が増えない）
- **`@hey-api/openapi-ts` の zod プラグインは採用しない**（理由は Alternatives）

## Consequences

- Good, because 生成物の差分が PR に載らない。openapi.yaml の変更だけをレビューすればよい
- Good, because zod スキーマの手書き漏れ・書き間違いは `satisfies` で typecheck が捕まえる。「openapi.yaml が唯一の正」（constitution）は崩れない
- Good, because ブランド付き id は `parse` を通った値しか作れない。未検証の文字列や別 entity の id を渡すコードは typecheck で落ちる
- Bad, because スキーマが増えるたびに `schemas.ts` を手で書く。スキーマ数が増えると `satisfies` エラーの追随が定常作業になる
- Bad, because openapi.yaml を変えた後、`pnpm generate-api` か `just be-gen` を叩くまでエディタの型は古いまま。commit 時は lefthook が再生成するので、古い型で commit されることはない
- Neutral, because ブランドは TypeScript 上の区別で、実行時には素の string。JSON にそのまま載る

## Implementation Plan

実装済み。以後の変更で従う規約として書く。

- **Affected paths**:
  - `frontend/src/shared/api/openapi.gen.ts` — 生成物。gitignore 対象。lint / format 対象外（`**/*.gen.ts`）
  - `frontend/src/shared/api/schemas.ts` — zod スキーマとブランド型。`components.schemas` に 1 つ追加したら、ここにも 1 つ追加する
  - `frontend/src/shared/api/index.ts` — `paths` / `components` / `operations` の re-export と、operationId から 200 応答の JSON 型を取る `ApiResponse<Op>`
  - `frontend/package.json` の `generate-api` と `postinstall`、`frontend/.gitignore`、`justfile` の `be-gen`、`lefthook.yaml` の `typecheck`、`.github/workflows/frontend-ci.yml` の生成ステップ
- **Dependencies**: `openapi-typescript`（devDependency）。`eslint` も devDependency に明示している（pnpm 11 が `eslint-plugin-react` の peer を自動解決しなくなったため。型生成とは無関係だが、同じ変更で入れた）
- **Patterns to follow**:
  - backend レスポンスを受けるサーバー関数は `schemas.ts` のスキーマで `parse` してから返す。`res.json()` をそのまま返さない
  - id を受けるサーバー関数の validator は `z.object({ id: itemId })` のようにブランド付きスキーマを使う。入力は素の文字列で受け、出力がブランド付きになる
  - スキーマに無い inline レスポンス（`/health` 等）は `satisfies z.ZodType<ApiResponse<"health">>` で縛る
  - 新しい entity の id は `schemas.ts` で `z.string().uuid().brand<"XxxId">()` を定義してから使う
- **Patterns to avoid**:
  - `openapi.gen.ts` を手で直す
  - `components["schemas"]["X"]` を UI の型として直接 import する（ブランドが無く、検証済みかどうかが型で分からなくなる）
  - `as ItemId` でブランドを付ける。ブランドは `parse` 経由でだけ付ける

### Verification

- [x] `git ls-files frontend/src/shared/api/openapi.gen.ts` が何も返さない（生成物は追跡されていない）
- [x] `openapi.gen.ts` を削除して `pnpm -C frontend run postinstall` すると再生成される（`pnpm install` は node_modules が最新だと "Already up to date" で script を飛ばす。clone 直後の install では走る）
- [x] `openapi.gen.ts` を削除して `lefthook run pre-commit` を実行すると、`typecheck` が生成してから検査して通る
- [x] `frontend-ci.yml` に `generate-api` ステップがあり、`pnpm install --frozen-lockfile --strict-peer-dependencies` が `openapi-typescript` 追加後も通る（lockfile をコピーしたクリーン環境で確認）
- [x] `schemas.ts` の各スキーマに `satisfies z.ZodType<components["schemas"]["X"]>` がある
- [x] `frontend/src/shared/api/schemas.test.ts` が通る（uuid でない id とカテゴリ外の値を拒否する）
- [x] `grep -rn 'components\["schemas"\]' frontend/src --include='*.tsx'` が何も返さない（UI は生成型を直接使わない）

## Alternatives Considered

- **`@hey-api/openapi-ts` の `typescript` + `zod` プラグインで型と zod スキーマを両方生成する**: スキーマの手書きが消え、openapi.yaml との乖離も原理的に起きない。しかし 2026-09 時点でブランド型は未対応（feature request #4341 は open、実装 PR #4164 は未マージ）。ブランドを付けるには生成した `zItem` を `zItem.extend({ id: zItem.shape.id.brand<"ItemId">() })` のように上書きする手書きレイヤーが結局要る。レスポンススキーマは「全応答の union」で生成されるので、200 だけ取る型も自前で組むことになる。スキーマ 5 個・60 行の現状では、生成基盤を 1 つ増やす分の方が大きい。**再検討条件**: スキーマが 10 を超える、または上流でブランド対応がリリースされる。そのときは `openapi-typescript` を外して hey-api に一本化し、`schemas.ts` はブランドを足す薄いレイヤーだけ残す
- **zod スキーマを書かず、生成型だけで済ませる**: 実行時検証が無く、backend の変更や不正な JSON が UI まで届く。サーバー関数の入力は既に zod で検証しており、レスポンスだけ検証しないのは一貫しない
- **レスポンス object 全体にブランドを付ける**: 「parse 済みしか流れない」は id ブランドで担保できる。object ブランドは `Pick` や spread のたびに剥がれ、UI 側で `as` が増える
- **生成物を commit し、openapi.yaml が staged なら pre-commit で再生成して `git add` する**: 一度こう実装した。clone 直後に生成なしで typecheck が通る利点はあるが、生成物の差分が PR に載る。フックが `git add` する副作用も持つ。frontend の `routeTree.gen.ts` は gitignore しており、同じ扱いに揃えた

## More Information

- 関連: [backend/0003 backend は frontend のサーバー関数からだけ呼ぶ](../backend/0003-call-backend-from-server-functions-only.md)（この ADR はその「型は openapi.yaml から生成する」を具体化したもの）
- 関連: [backend/0002 エラーは RFC 9457 Problem Details で返す](../backend/0002-return-errors-as-rfc9457-problem-details.md)（`schemas.ts` の `problem` はこの形。`backendFetch` のエラー処理にはまだ繋いでいない）
- 参考: [Hey API Zod v3 Plugin](https://heyapi.dev/docs/openapi/typescript/plugins/zod/v3)、[hey-api/openapi-ts issues (brand)](https://github.com/hey-api/openapi-ts/issues?q=brand)
