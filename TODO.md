# TODO

未着手の作業。完了したら `[x]` を付ける (消さない)。決定が要るものは ADR、機能は spec-kit (`specs/`) に起こす。

## デプロイ・運用 (adr/backend/0006 の残課題)

- [x] **backend の到達制限** (2026-09-24): `X-Backend-Token` を検証する middleware を `newRouter` に追加。`backendFetch` が同じヘッダを付ける。詳細は adr/backend/0006
- [ ] **到達制限の secret 投入とデプロイ**: justfile `be-deploy` のコメントの手順で `backend-token` を作り、`just be-deploy` → adr/backend/0006 の Verification (401 / 200) を確認
- [ ] **Workers に `BACKEND_URL` と `BACKEND_TOKEN` を設定**: `wrangler secret put BACKEND_URL` に Cloud Run の URL、`BACKEND_TOKEN` は上と同じ値。`backend.server.ts` は既に両方読む
- [ ] **CI からのデプロイ**: 今は `just be-deploy` / `just db-migrate-prod` を手動実行。GitHub Actions + Workload Identity Federation (鍵なし) に載せる。手動運用が固まってから
- [ ] **Cloud SQL の authorized networks が空であることを確認**: Public IP を持っているので、空でなければ外部から直接接続できる。空ならコネクタ + IAM 経由のみ
- [ ] **DB バックアップの復元手順**: Cloud SQL の日次バックアップは有効。`pg_dump` を GCS に置く運用と復元手順を一度試して docs に書く
- [ ] **月額の確認**: 1 か月後に請求を見る。目安は $11〜16 (issue #8)。超えるなら再検討 (adr/backend/0006 の再検討条件)

## frontend と backend の接続

- [ ] `db.server.ts` のインメモリ固定データを backend の `GET /items` に置き換える (`backend.server.ts` の `backendFetch` 経由)。`/health` は接続済み
- [ ] 接続後、adr/backend/0003 の検証項目 `grep -r "8080\|BACKEND_URL" frontend/src --include='*.tsx' --include='*.ts' | grep -v '\.server\.ts'` が空であることを確認

## 機能 (specs/)

- [ ] `specs/001-digest-builder`: plan.md まで。tasks / implement が未着手
- [ ] `specs/002-article-digest-view`: spec.md のみ。plan 以降が未着手

## その他

- [ ] `item-data-model.md` (リポジトリ直下、未追跡) を specs か docs に移すか削除する
- [ ] 認証・認可 (adr/backend/0003 で未決)。必要になるまで着手しない
