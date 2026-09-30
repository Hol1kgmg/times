# 本番デプロイ

構成と判断の記録は [adr/backend/0006](../adr/backend/0006-host-backend-on-cloud-run-and-cloud-sql.md)。ここには手順だけを置く。

GCP の変更 (デプロイ、マイグレーション、秘密と環境変数) は [GCP コンソール](https://console.cloud.google.com/) で行う。`gcloud` は状況確認 (6 節) にだけ使う。

| 項目 | 値 |
|---|---|
| プロジェクト ID | `project-34107f2d-36dc-49d8-a58` |
| リージョン | `asia-northeast1` |
| Cloud SQL 接続名 | `project-34107f2d-36dc-49d8-a58:asia-northeast1:times-db` |
| Cloud Run Service / Job | `times-api` / `times-migrate` |
| イメージ置き場 (Artifact Registry) | `cloud-run-source-deploy` |

## 1. 初回だけ: ビルドトリガー

ブラウザからは手元のソースを送れないので、Cloud Build が GitHub の `main` を取得してビルドする。トリガーは手動起動にする (マイグレーション → API の順を人が守るため)。

### デプロイ用サービスアカウント

IAM と管理 → サービス アカウント → 作成。名前は `times-deploy`。プロジェクトのロールを 3 つ付ける。

| ロール | 用途 |
|---|---|
| Cloud Run デベロッパー (`roles/run.developer`) | Service / Job のイメージ差し替え |
| Artifact Registry 書き込み (`roles/artifactregistry.writer`) | イメージの push |
| ログ書き込み (`roles/logging.logWriter`) | ビルドログ |

続けて、実行用アカウント `1050352560553-compute@developer.gserviceaccount.com` の詳細 → アクセス権を持つプリンシパル → アクセスを許可 で、`times-deploy` に サービス アカウント ユーザー (`roles/iam.serviceAccountUser`) を付ける。これが無いとデプロイのステップが `iam.serviceaccounts.actAs` で失敗する。

実行用アカウントをビルドに流用しない。動いている API が自分自身を差し替えられるようになる。

### トリガー

Cloud Build → リポジトリ で GitHub の `Hol1kgmg/times` を接続する (リージョンは `asia-northeast1`)。その後 Cloud Build → トリガー → トリガーを作成 で 2 つ作る。

| 項目 | API 用 | マイグレーション用 |
|---|---|---|
| 名前 | `times-api` | `times-migrate` |
| リージョン | `asia-northeast1` | `asia-northeast1` |
| イベント | 手動呼び出し | 手動呼び出し |
| ソース | `Hol1kgmg/times`、ブランチ `main` | 同左 |
| 構成 | Cloud Build 構成ファイル | 同左 |
| 構成ファイルの場所 | `backend/cloudbuild.yaml` | `backend/db/cloudbuild.yaml` |
| サービス アカウント | `times-deploy` | `times-deploy` |

トリガーはイメージを差し替えるだけで、秘密・環境変数・Cloud SQL 接続は Cloud Run 側の設定を引き継ぐ。

## 2. 秘密と環境変数

秘密は Secret Manager に置き、Cloud Run が環境変数として注入する。

| 環境変数 | Secret Manager の名前 | 注入先 |
|---|---|---|
| `DATABASE_URL` | `database-url` | `times-api`, `times-migrate` |
| `BACKEND_TOKEN` | `backend-token` | `times-api` |
| `GITHUB_CLIENT_SECRET` | `GITHUB_CLIENT_SECRET` | `times-api` |
| `GITHUB_CLIENT_ID` | `GITHUB_CLIENT_ID` | `times-api` |
| `ADMIN_GITHUB_LOGIN` | `ADMIN_GITHUB_LOGIN` | `times-api` |

`GIN_MODE=release` だけは `times-api` の環境変数に直接置いている。

- **値を変える**: Secret Manager → 対象の秘密 → 新しいバージョン。続けて Cloud Run → `times-api` → 新しいリビジョンの編集とデプロイ → 何も変えずにデプロイ (起動済みのインスタンスは古い値を持ったままなので、リビジョンを作り直す)
- **変数を足す・外す**: Cloud Run → `times-api` → 新しいリビジョンの編集とデプロイ → 変数とシークレット

`DATABASE_URL` の値は Cloud SQL コネクタの Unix socket (`/cloudsql/<Cloud SQL 接続名>`) を指す接続文字列。

## 3. マイグレーション (変更があるときだけ、API より先に)

1. Cloud Build → トリガー → `times-migrate` → 実行 (ブランチ `main`)。ビルドの成功を待つ
2. Cloud Run → ジョブ → `times-migrate` → 実行
3. 実行の詳細が成功になり、ログに `3/u create_users_and_sessions` のような適用行が出ていることを確認する

`up` 以外は、ジョブの 実行 の横のメニュー → オーバーライドを使用して実行 → コンテナの引数 に 1 語ずつ入れる。

| やりたいこと | 引数 |
|---|---|
| 現在の版を見る (結果は実行のログに出る) | `version` |
| 1 つ戻す | `down` `1` |
| dirty を解く | `force` `<直前の版>` |

Timeout (5m) を超えて kill されると dirty になる。`version` で確認し、`force` で戻してから再実行する。`force` は版の記録を書き換えるだけで SQL は流さないので、テーブルが途中まで作られていないかを先に確認する。

## 4. API

1. Cloud Build → トリガー → `times-api` → 実行 (ブランチ `main`)
2. Cloud Run → `times-api` → リビジョン で、新しいリビジョンがトラフィック 100% を受けていることを確認する

戻すときは リビジョン → トラフィックを管理 で、前のリビジョンに 100% を割り当てる。

## 5. frontend

Workers ダッシュボードの Git 連携 (Workers Builds) が `main` への push でビルドしてデプロイする。手元から `wrangler deploy` は打たない (justfile にも置かない)。

1. Workers & Pages → `times` → デプロイ で、`main` の最新コミットのバージョンがビルド成功していることを確認する
2. 変数を足したり変えたりしたときは、設定 → Runtime variables and secrets で保存したあと Deploy を押す (保存だけでは反映されない)

戻すときは デプロイ → バージョン履歴 で前のバージョンにロールバックする。

Workers の変数はダッシュボードの Runtime variables and secrets で管理する (`keep_vars = true` で deploy 時に保持)。変数の一覧は [docs/admin-login.md](admin-login.md)。

## 6. 状況確認 (gcloud、読み取りだけ)

`gcloud` は devShell (`nix develop`) にある。ここに変更系のコマンドを足さない。

```sh
GCP_PROJECT=project-34107f2d-36dc-49d8-a58
GCP_REGION=asia-northeast1

# リビジョンと、マイグレーションの実行履歴
gcloud run revisions list --service=times-api --project="$GCP_PROJECT" --region="$GCP_REGION" --limit=3
gcloud run jobs executions list --job=times-migrate --project="$GCP_PROJECT" --region="$GCP_REGION" --limit=3

# ビルド履歴
gcloud builds list --project="$GCP_PROJECT" --region="$GCP_REGION" --limit=5

# API のログ
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="times-api"' \
    --project="$GCP_PROJECT" --limit=50 \
    --format="value(timestamp,jsonPayload.level,jsonPayload.msg,jsonPayload.method,jsonPayload.path,jsonPayload.status,jsonPayload.duration_ms,jsonPayload.err,textPayload)"

# マイグレーションのログ
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="times-migrate"' \
    --project="$GCP_PROJECT" --limit=20 --format="value(timestamp,textPayload)"
```

zsh では `"$A:$B:times-db"` のように変数の直後へ `:t` が続くと修飾子として解釈され、文字が消える。変数を `:` でつなぐときは `${A}` と書く。
