<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - V. 品質ゲート → V. 品質はテストとスキーマで判断する
    (完了判定の基準を「テストとスキーマ」に明示。spec → schema → test の対応を必須化)
- Governance: 完了判定が原則 V に従う旨を追記
- Added sections (1.0.0 initial ratification):
  - Core Principles (I. 仕様駆動, II. 契約ファースト, III. サーバー関数経由のみ,
    IV. 最小実装 (YAGNI), V. 品質ゲート)
  - 技術スタックと制約
  - 開発ワークフロー
  - Governance
- Removed sections: none
- Templates: .specify/templates/* は本文書を実行時に参照するため変更なし
- Follow-up TODOs: none
-->

# times Constitution

## Core Principles

### I. 仕様駆動 (Spec-Driven Development)

機能開発は spec-kit の順序 `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement` に従わなければならない (MUST)。実装着手前に計画を提示し、承認を得るまで
コードを変更してはならない (MUST NOT)。仕様書 (spec.md) は「何を・なぜ」だけを記述し、
技術的な「どう作るか」は plan.md に置く。

根拠: 承認前の実装は手戻りを生む。仕様と計画を分けることで、判断の記録 (ADR) と実装の
記録 (git) が混ざらない。

### II. 契約ファースト (Contract-First)

- backend の API は `backend/api/openapi.yaml` が唯一の正であり、ハンドラは oapi-codegen の
  strict server から生成した interface を実装しなければならない (MUST)。
- DB アクセスは `db/queries/*.sql` から sqlc で生成したコードのみを使う (MUST)。
  手書きの SQL 文字列をハンドラに置いてはならない (MUST NOT)。
- 生成物 (`internal/api`, `internal/db`) はコミットし、CI で `just be-gen` の差分がないことを
  検証する。OpenAPI や SQL を変更したら同一コミットで再生成する (MUST)。
- エラー応答はすべて RFC 9457 Problem Details で返す (MUST)。一覧応答は `{items: [...]}` で
  包む (MUST)。

根拠: 契約から生成することで、型・検証・ドキュメントが自動で一致する。生成物を
コミットすれば差分レビューが可能になる。

### III. backend はサーバー関数経由のみ (Server-Function Boundary)

backend を呼ぶのは frontend の TanStack Start サーバー関数だけとする (MUST)。ブラウザから
backend を直接呼んではならず (MUST NOT)、CORS や API バージョニングは導入しない。
サーバー関数の入力は Zod で検証する (MUST)。

根拠: 信頼境界を frontend サーバーに一本化することで、認証・検証・エラー変換の実装箇所が
1 か所に閉じる (adr/backend/0003)。

### IV. 最小実装 (YAGNI, NON-NEGOTIABLE)

- 現時点で必要のない抽象化・層分け・設定・依存を追加してはならない (MUST NOT)。
  ハンドラは sqlc の Queries を直接呼び、リポジトリ層やサービス層は置かない。
- 標準ライブラリ、既存コード、既にインストール済みの依存で済むなら新しい依存を追加しない
  (MUST)。
- UI の複合ブロックは、複数ページで同じものが出るまで React コンポーネントに昇格させない
  (MUST NOT)。
- 意図的に切った角 (既知の上限を持つ簡略化) には `ponytail:` コメントで上限と拡張経路を
  残す (MUST)。
- 複雑さを追加する場合は plan.md の Complexity Tracking に理由と却下した代替案を記す
  (MUST)。

根拠: 書かなかったコードは保守もデバッグも要らない。「後で必要になるかも」は根拠に
ならない。

### V. 品質はテストとスキーマで判断する (Tests and Schemas Decide Quality)

品質の判定基準はテストとスキーマであり、レビューアの印象や口頭の説明ではない (MUST)。

- **スキーマ**: 仕様 (spec.md) の要件は、OpenAPI (`openapi.yaml`)、DB スキーマ
  (`db/migrations`)、サーバー関数の Zod スキーマのいずれかに落とし込む (MUST)。
  スキーマに現れない要件は実装済みとみなさない。
- **テスト**: spec.md の各 User Story / 受け入れシナリオは、対応するテスト
  (Vitest / Playwright / go test) が通ることをもって完了とする (MUST)。
  分岐・ループ・パーサー・境界検証など自明でないロジックには、壊れたら落ちる最小の
  テストを 1 つ残す (MUST)。自明な 1 行に対するテストは不要。
- **ゲート**: pre-commit (lefthook) と CI が通らない変更をマージしてはならない (MUST NOT)。
  frontend: lint / markuplint / typecheck / test、backend: gofmt / go vet / go test /
  `be-gen` 差分なし。
- DB に接続するテストは書かない。クエリとスキーマの整合は sqlc の生成時に検証される。
  必要になったら CI で compose の `db` を起動する方針に切り替える。
- pre-commit の gitleaks でシークレットの混入を止める。シークレットをコミットしては
  ならない (MUST NOT)。

根拠: 仕様 → スキーマ → テストと機械的に検証できる形に落とすことで、「仕様どおりか」の
判断が人の解釈に依存しなくなる。レビューは設計と意図の確認に集中できる。

## 技術スタックと制約

正確なバージョンは `backend/go.mod`、`frontend/package.json`、`flake.lock` が定義元。
詳細は [docs/tech-stack.md](../../docs/tech-stack.md)。

- **backend**: Go / Gin (oapi-codegen strict server の下に隠す) / sqlc + pgx v5 /
  PostgreSQL 18 / golang-migrate (手書きの命令型マイグレーション)。環境変数は
  `DATABASE_URL` と `PORT` のみ。ログは slog の JSON を stdout へ。
- **frontend**: React 19 / TanStack Start + Router / Zod / Vite / CSS Modules + PostCSS /
  TypeScript strict / ultracite (oxlint + oxfmt) / Vitest / Playwright。
  デプロイ先は Cloudflare Workers。
- **frontend 構成**: Feature-Sliced Design v2.1 に従う (MUST)。`routes/` は TanStack Router の
  規約なので FSD の外に置く。
- **UI**: 色・影・角丸・余白・タイポグラフィは `frontend/src/app/styles/global.css` の
  トークンで指定し、CSS Modules に生の値を書いてはならない (MUST NOT)。ルールの詳細は
  `.agents/rules/frontend-ui-design.md`。
- **開発環境**: Nix devShell (direnv) と Docker Compose。操作はルートの `justfile` 経由で
  行う。レシピ名は `fe-*` / `be-*` / `db-*` / prefix なし (全体) の命名に従う (MUST)。

## 開発ワークフロー

- 機能開発は Core Principles I の spec-kit サイクルに従う。仕様・計画・タスクは
  `specs/<NNN-feature>/` に置く。
- コードを読んでも分からない設計判断は ADR として `adr/<owner>/` に記録する (MUST)。
  `adr/from-template/` はテンプレート元の所有であり、派生リポジトリでは編集しない
  (MUST NOT)。
- テンプレート元の取り込み (`just sync`) はマージコミットで行う (MUST)。squash / rebase は
  共通祖先を壊すため禁止 (adr/from-template/0001)。
- レビューは本 constitution への準拠を確認する。違反がある場合は plan.md の
  Complexity Tracking に正当化が記されていなければならない。
- ファイル操作は専用ツール (Read / Edit / Write / Glob / Grep) を優先する。

## Governance

- 本 constitution はプロジェクト内の他の慣習・ドキュメントに優先する。矛盾する場合は
  本文書に合わせて他方を修正する。
- 改正は `/speckit-constitution` で行い、Sync Impact Report を先頭コメントに残す。
  改正はコミットとして記録し、影響する ADR や rules があれば同一 PR で更新する。
- バージョンはセマンティックバージョニングに従う。
  - MAJOR: 原則の削除・再定義など後方互換のない変更
  - MINOR: 原則・セクションの追加、または指針の実質的な拡張
  - PATCH: 表現の明確化、誤字修正など意味を変えない修正
- 準拠確認: `/speckit-plan` の Constitution Check と PR レビューで、各原則への準拠を
  確認する。完了判定は原則 V に従い、テストとスキーマで行う。

**Version**: 1.1.0 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-22
