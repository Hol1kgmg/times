# backend 技術スタック

正確なバージョンは [backend/go.mod](../backend/go.mod)、ツールは flake.lock、イメージは [compose.yaml](../compose.yaml)。

| 分類 | ツール | 備考 |
|---|---|---|
| 言語 | Go | flake.nix が定義元。CI も Nix devShell で同じバージョンを使う |
| HTTP | Gin | |
| API 定義 | OpenAPI 3.0 + oapi-codegen (strict server) | [backend/api/openapi.yaml](../backend/api/openapi.yaml) が正。`internal/api/gen.go` は生成物だがコミットする。リクエスト検証は gin-middleware が spec から行う |
| DB | PostgreSQL 18 | compose の `db` サービス |
| DB アクセス | sqlc + pgx/v5 | `db/queries/*.sql` から `internal/db/` を生成。uuid / timestamptz は Go 標準型に override |
| マイグレーション | golang-migrate | `db/migrations/NNNNNN_<name>.{up,down}.sql`。CLI は compose の `migrate` サービス（Nix 版が macOS で動かないため） |
| コンテナ | Docker Compose | db → migrate (one-shot) → api の順に起動 |

## 構成

```
backend/
  cmd/server/         main.go: Gin 起動、pgxpool 接続、strict handler 登録
  internal/handler/   StrictServerInterface 実装。sqlc の Queries を直接呼ぶ（層分けなし）
  internal/apperr/    handler が返す想定内エラー。cmd/server が RFC 9457 Problem Details に変換（adr/backend/0002）
  internal/api/       oapi-codegen 生成物
  internal/db/        sqlc 生成物
  api/                openapi.yaml, oapi-codegen.yaml
  db/migrations/      golang-migrate
  db/queries/         sqlc
```

## 運用

- `just db-up` で Postgres 起動 + マイグレーション、`just be-dev` でサーバー起動（localhost:8080）
- `just be-up` で api も含めて compose 一式をビルド・起動
- API や SQL を変えたら `just be-gen` で再生成してコミット。CI が差分なしを検証する
- マイグレーション追加は `just db-migrate-new <name>`、適用は `just db-up`（up）または `just db-migrate <args>`
- pre-commit ([lefthook.yaml](../lefthook.yaml)): gofmt / go vet / go test
- CI ([backend-ci.yml](../.github/workflows/backend-ci.yml)): be-gen 差分 / be-lint / be-test

# frontend 技術スタック

正確なバージョンは [frontend/package.json](../frontend/package.json)。

| 分類 | ツール | 備考 |
|---|---|---|
| ランタイム | Node.js 24 / pnpm 11 | Node は flake.nix、pnpm はルート package.json が定義元 |
| UI | React 19 | |
| フレームワーク | TanStack Start / Router | SSR・サーバー関数・ファイルベースルーティング。`routeTree.gen.ts` は生成物 |
| 検証 | Zod | サーバー関数の入力 |
| アーキテクチャ | Feature-Sliced Design (v2.1) | `src/` をレイヤー / スライス / セグメントで構成。`routes/` は TanStack Router の規約なので FSD の外に置く |
| ビルド | Vite 8 | `cssTarget` を Safari 16.3 に固定（range 構文のメディアクエリ回避） |
| スタイル | CSS Modules / PostCSS | `@custom-media` を `styles.css` で一元定義 |
| フォント | Klee One (@fontsource) | |
| 型検査 | TypeScript 6 | strict |
| Lint / Format | ultracite (oxlint + oxfmt) | ESLint 本体なし。eslint-plugin-react 等は oxlint の JS プラグインで読む |
| マークアップ検査 | markuplint | TSX 対象 |
| ユニットテスト | Vitest / Testing Library | jsdom、カバレッジ v8 |
| E2E | Playwright | Chromium |
| デプロイ | Cloudflare Workers (wrangler) | `dist/server` を Worker、`dist/client` をアセットとして配信 |

## 運用

- 操作はルートの [justfile](../justfile) 経由（`just fe-dev` / `just fe-test` / `just fe-lint`）。npm 依存の更新は `just fe-upgrade`
- pre-commit ([lefthook.yaml](../lefthook.yaml)): gitleaks / lint / markuplint / typecheck / test
- CI ([frontend-ci.yml](../.github/workflows/frontend-ci.yml)): typecheck / lint / test
- pnpm は `allowBuilds` でビルドスクリプトを制限し、公開後 48 時間未満のパッケージを取り込まない ([pnpm-workspace.yaml](../frontend/pnpm-workspace.yaml))
