---
status: 'accepted'
date: 2026-09-24
decision-makers: 'Hol1kgmg'
---

# backend は GCP の Cloud Run + Cloud SQL で動かし、frontend は Cloudflare Workers に据え置く

## Context and Problem Statement

[0003](0003-call-backend-from-server-functions-only.md) で backend のホスティング先は未決のまま残した。frontend は Cloudflare Workers に決まっているが、Cloudflare にはマネージド Postgres が無く、Go コンテナを常駐させる場所も無い。

選択肢とコスト目安は issue [#8](https://github.com/Hol1kgmg/times/issues/8) にまとめた。要点は次の 2 軸。

- **Cloudflare で完結** (Go backend を捨て、Workers から D1 か外部 Postgres を直接叩く): 最安だが `backend/` の Go + sqlc + OpenAPI の資産を捨て、Postgres を SQLite に書き直すか、東京リージョンの無い外部 Postgres に往復レイテンシを払う
- **Go backend + Postgres を残す** (AWS か GCP): 月 $6〜40。Workers からの 1 ホップは東京同士なら問題にならない

前提は個人〜少人数利用、小規模トラフィック、利用者は日本。

## Decision

**GCP の Cloud Run + Cloud SQL (asia-northeast1) を採る。** frontend は Workers 据え置き。

- Cloud Run Service `times-api`: `backend/Dockerfile` をそのまま `gcloud run deploy --source backend` でビルド・デプロイ。min instances 0、`PORT` は Cloud Run が注入する
- Cloud SQL `times-db`: PostgreSQL 18、db-f1-micro (共有コア)、SSD 10GB、日次バックアップ。Cloud Run からは Cloud SQL コネクタ (Unix socket `/cloudsql/<connection name>`) で接続する
- 接続文字列は Secret Manager `database-url` に置き、`DATABASE_URL` として注入する。アプリの環境変数は引き続き `DATABASE_URL` と `PORT` の 2 つだけ
- マイグレーションは Cloud Run Job `times-migrate` で適用する。`backend/db/Dockerfile` が `migrate/migrate` イメージに `db/migrations/` を焼き、`DATABASE_URL` を読んで `up` する。compose の `migrate` サービスと同じ発想
- ソースアップロードは `backend/.gcloudignore` で `.agents/` と `.direnv/` を除外する。どちらも Nix store への参照で mtime が 1970 のため、zip 化が失敗する

AWS ではなく GCP にした理由: Cloud Run はゼロスケールし、NAT Gateway / ALB / Public IPv4 のような固定費の罠が無い。同じ運用負荷の AWS 構成 (App Runner + RDS) より月額で半分以下。EC2 1 台に compose を載せる案の方が安いが、バックアップと OS パッチを自前で持つことになる。

**未決のまま残すもの**

- backend への到達制限。Workers は GCP の外なので Cloud Run は未認証公開 (`--allow-unauthenticated`) にしている。0003 の通り共有シークレット方式で制限する。書き込み API が誰でも叩ける状態なので、frontend を繋ぐ前に入れる
- CI からのデプロイ。今は手動の `gcloud run deploy`。固まったら GitHub Actions + Workload Identity Federation に載せる

## Consequences

- Good, because `backend/` のコードは一切変えずに動く。Dockerfile、`DATABASE_URL`、golang-migrate の SQL をそのまま使う
- Good, because 計算費はほぼ無料枠内。固定費は Cloud SQL の $10〜13/月だけ
- Good, because HTTPS エンドポイント、ログ (Cloud Logging)、Secret 管理が追加費用なしで付く
- Bad, because db-f1-micro は共有コアで SLA 対象外。性能が足りなくなったら tier を上げる (インスタンス再作成なしで変更できる)
- Bad, because Cloud SQL は停止しても Public IP 待機料金が乗る。使わない期間が長いならインスタンスを消して `pg_dump` を GCS に置く方が安い
- Bad, because ゼロスケールなのでコールドスタートが乗る (Go なので 1 秒未満)。気になったら min instances 1 にする (+$5〜10/月)

## Implementation Plan

実施済み (2026-09-24)。

- **Affected paths**: `backend/db/Dockerfile` (新規)、`backend/.gcloudignore` (新規)、`backend/.dockerignore` (`.agents/` `.direnv/` を追加)、`flake.nix` (`google-cloud-sdk` を devShell に追加)、`skills.nix` (google/skills の gcloud / cloud-run / cloud-sql スキル)
- **Dependencies**: なし (アプリ側の依存は変えない)
- **Patterns to follow**:
  - GCP リソースの操作は devShell の `gcloud` で行い、`--project` と `--region` を明示する
  - マイグレーション追加後は `gcloud run jobs execute times-migrate --wait` を先に流し、次に `gcloud run deploy times-api --source backend`
  - 秘密情報 (DB パスワード、`DATABASE_URL`) は Secret Manager にだけ置く。リポジトリにも issue にも書かない
- **Patterns to avoid**:
  - `DATABASE_URL` に Cloud SQL の Public IP を直書きする (コネクタ経由の Unix socket を使う)
  - Cloud Run の環境変数に秘密情報を平文で入れる (`--set-env-vars` ではなく `--set-secrets`)

### Verification

- [x] `curl https://<service url>/health` が 200
- [x] `curl https://<service url>/items` が 200 `{"items":[]}` (Cloud SQL 接続と `create_items` マイグレーションの確認)
- [x] `gcloud run jobs executions list --job=times-migrate` に成功した実行がある

## Alternatives Considered

- **Cloudflare D1 で完結**: 月 $0〜5 で最安。しかし Postgres → SQLite の書き直しと Go 資産の廃棄、0003 の supersede を伴う。backend を作り直す規模のコストになるので見送り
- **Cloudflare Workers + 外部 Postgres (Neon / Supabase)**: Neon は東京リージョンが無く、シンガポール往復で 1 クエリ 70ms 前後が乗る。Supabase は東京があるが無料枠は非アクセスで停止する。どちらも Go backend を捨てる点は D1 と同じ
- **AWS Lightsail / EC2 1 台に compose をそのまま載せる**: 月 $6〜10 で最安の「Go を残す」案。移行コストゼロだがバックアップと OS・Postgres のパッチが自前。データを失うのが怖くなった時点で結局マネージドに移すので、最初からマネージドにした
- **AWS App Runner + RDS**: 運用負荷は GCP と同等だが月 $25〜40。RDS の Public IPv4 課金と、VPC を跨ぐと NAT Gateway ($32/月) が乗る罠がある
- **GCE e2-micro 1 台**: EC2 案の GCP 版。東京は無料枠対象外で約 $8/月。EC2 案と同じ理由で見送り

## More Information

- 検討経緯と料金表: issue [#8](https://github.com/Hol1kgmg/times/issues/8)
- 関連: [0003](0003-call-backend-from-server-functions-only.md) (backend を呼ぶのは Workers のサーバー関数だけ。到達制限は共有シークレット方式)
- 再検討条件: 月額が $30 を超えた、db-f1-micro の性能が足りない、GCP 以外に置く理由 (組織の都合、他サービスとの統合) が出た
