---
name: "speckit-explain"
description: "Explain the spec-kit workflow and what each speckit-* skill does, in what order, and which files it reads/writes. Use when the user asks what a speckit skill is for, which one to run next, or wants an overview of the SDD cycle."
argument-hint: "Optional: a skill name (e.g. plan) or 'all'"
user-invocable: true
---

# speckit-explain

引数なし、または `all` なら全体像を出す。スキル名が指定されたらそのスキルの節だけを出す。
ファイルは読まず、以下の内容をそのまま日本語で説明する。実行はしない。

## 全体像

spec-kit は Spec-Driven Development のワークフロー。成果物は `specs/<NNN-feature>/` に溜まり、
各スキルは前段の成果物を入力にして次の成果物を作る。`.specify/memory/constitution.md` が全スキル共通の憲法。

```
constitution (初回のみ)
  └─ specify ──▶ clarify (任意) ──▶ plan ──▶ tasks ──▶ analyze (任意) ──▶ implement ──▶ converge (任意)
                                                        └─ checklist (任意)   └─ taskstoissues (任意)
```

このリポジトリの必須経路は `specify → plan → tasks → implement` (AGENTS.md の Work Rules)。

## 各スキル

### speckit-constitution
- 役割: プロジェクトの原則 (憲法) を作成・更新する。
- 入力: ユーザーが与える原則、`.specify/templates/constitution-template.md`
- 出力: `.specify/memory/constitution.md`
- タイミング: プロジェクト初回、または原則を変えたいとき。

### speckit-specify
- 役割: 自然言語の機能説明から仕様書を作る。「何を・なぜ」を書き、「どう作るか」は書かない。
- 入力: 機能説明 (引数)、constitution
- 出力: `specs/<NNN-feature>/spec.md`、feature ブランチ、`.specify/feature.json`
- タイミング: 新機能の最初。

### speckit-clarify
- 役割: spec の曖昧な箇所を最大 5 問の質問で潰し、回答を spec に書き戻す。
- 入力: `spec.md`
- 出力: `spec.md` (Clarifications セクション追記)
- タイミング: specify の後、plan の前。spec に不明点が残るとき。

### speckit-plan
- 役割: spec を技術設計に落とす。技術選定、データモデル、契約、検証手順を作る。
- 入力: `spec.md`、constitution
- 出力: `plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/`
- タイミング: spec 承認後。

### speckit-tasks
- 役割: plan 群から依存順に並んだ実行可能なタスク一覧を作る。
- 入力: `spec.md`、`plan.md`、`data-model.md`、`research.md`、`quickstart.md`
- 出力: `tasks.md`
- タイミング: plan 承認後。

### speckit-analyze
- 役割: spec / plan / tasks の整合性と品質を読み取り専用でチェックし、矛盾・漏れ・重複を報告する。
- 入力: `spec.md`、`plan.md`、`tasks.md`、constitution
- 出力: レポートのみ (ファイルは変更しない)
- タイミング: tasks 後、implement 前。

### speckit-checklist
- 役割: 指定ドメイン (セキュリティ、UX など) の要件チェックリストを作る。「要件のユニットテスト」。
- 入力: ドメイン指定 (引数)、`spec.md`、`plan.md`、`tasks.md`
- 出力: `specs/<NNN-feature>/checklists/<domain>.md`
- タイミング: 任意。要件の抜けを観点別に確認したいとき。

### speckit-implement
- 役割: `tasks.md` を順に実行して実装する。完了タスクは `[X]` にマークする。
- 入力: `tasks.md` と plan 群
- 出力: 実装コード、更新された `tasks.md`
- タイミング: tasks (と analyze) の後。

### speckit-converge
- 役割: 実装済みコードを spec / plan / tasks と突き合わせ、未着手の作業を `tasks.md` に追記する。
- 入力: コードベース、`spec.md`、`plan.md`、`tasks.md`
- 出力: `tasks.md` (追記)
- タイミング: implement が途中で止まった、または手動実装で差分が出たとき。再度 implement で残りを消化する。

### speckit-taskstoissues
- 役割: `tasks.md` の各タスクを GitHub Issue に変換する。
- 入力: `tasks.md`
- 出力: GitHub Issues
- タイミング: 任意。タスクを Issue で管理したいとき。

## 次に何を実行すべきか

`specs/<NNN-feature>/` を見て判断する。

| 存在するファイル | 次に実行 |
|---|---|
| なし | `/speckit-specify` |
| `spec.md` のみ | `/speckit-clarify` (任意) → `/speckit-plan` |
| `plan.md` あり、`tasks.md` なし | `/speckit-tasks` |
| `tasks.md` あり、未着手 | `/speckit-analyze` (任意) → `/speckit-implement` |
| `tasks.md` に `[ ]` が残る | `/speckit-implement`、コードと乖離があれば `/speckit-converge` |
