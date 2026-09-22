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

- 操作はルートの [justfile](../justfile) 経由（`just dev` / `just test` / `just lint`）。npm 依存の更新は `just upgrade`
- pre-commit ([lefthook.yaml](../lefthook.yaml)): gitleaks / lint / markuplint / typecheck / test
- CI ([frontend-ci.yml](../.github/workflows/frontend-ci.yml)): typecheck / lint / test
- pnpm は `allowBuilds` でビルドスクリプトを制限し、公開後 48 時間未満のパッケージを取り込まない ([pnpm-workspace.yaml](../frontend/pnpm-workspace.yaml))
