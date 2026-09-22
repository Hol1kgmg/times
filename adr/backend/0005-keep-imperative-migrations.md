---
status: 'accepted'
date: 2026-09-22
decision-makers: 'Hol1kgmg'
---

# マイグレーションは手書きの命令型のまま、宣言型スキーマ (Atlas) は採用しない

## Context and Problem Statement

backend のコードは 3 つの定義ファイルから生成している。

```
openapi.yaml    ──(oapi-codegen)──→ ハンドラ IF・リクエスト/レスポンス型
db/migrations/  ──(golang-migrate)─→ DB スキーマ
db/queries/     ──(sqlc)──────────→ 型安全な DB アクセスコード
```

このうちスキーマだけは「正」が `schema.sql` のような 1 ファイルではなく、手書きの up/down マイグレーションの積み上げになっている。sqlc も `db/migrations` を読んでスキーマを組み立てる。

`schema.sql` を正にして Atlas で差分マイグレーションを生成する宣言型にすれば、スキーマ全体が 1 ファイルで読め、up/down の手書きミスも消える。これに切り替えるか判断する。

## Decision

今の命令型 (golang-migrate + 手書き up/down) を維持する。宣言型は採用しない。

- スキーマの正は `db/migrations/` の積み上げ。sqlc の `schema:` もここを指したままにする
- `db/schema.sql` は置かない。migrations との二重管理になる
- goose 等の別の命令型ツールへの乗り換えもしない。構造が変わらないので利点がない

**再検討条件**: テーブルが 5 つ前後になり、現在のスキーマを把握するのに migrations を頭から読むようになった時。Atlas の `migrate diff` は既存の migrations ディレクトリをそのまま引き継げるので、今から備える必要はない。

## Consequences

- Good, because 追加のツール・配線が要らない。golang-migrate は compose の `migrate` イメージで既に動いており、CI とドキュメントもそれ前提
- Good, because sqlc は migrations から生成時にスキーマとクエリの整合を検証するので、宣言型の主な利点の一つは既に得ている
- Bad, because スキーマ全体を 1 ファイルで読めない。テーブルが 1 つの今は問題にならない
- Bad, because up/down の手書きミスは検出されない。マイグレーションが 1 本の今は問題にならない

## Implementation Plan

- **Affected paths**: なし (現状維持)
- **Patterns to follow**: スキーマ変更は `just db-migrate-new <name>` で up/down を書く
- **Patterns to avoid**: `db/schema.sql` を別途置いてスキーマを二重に持つ

### Verification

- [x] `backend/sqlc.yaml` の `schema:` が `db/migrations` を指している (2026-09-22)

## Alternatives Considered

- **Atlas 宣言型**: `schema.sql` から差分マイグレーションを生成する。差分生成に dev database が必要で、CLI の Nix 対応確認 (golang-migrate で Nix 版が macOS で panic した前例あり) と justfile 改修が要る。テーブル 1 つ、マイグレーション 1 本の今は得るものがほぼ無い
- **`db/schema.sql` を置いて sqlc だけそこを読む** (Atlas なし): スキーマの一覧性だけ先に得られるが、migrations との二重管理になる
- **goose に乗り換え**: golang-migrate と同じ命令型で構造が変わらない。動いているものを替える理由がない

## More Information

- 関連: [docs/tech-stack.md](../../docs/tech-stack.md) の「マイグレーション」行
