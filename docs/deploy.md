# 本番デプロイ

構成と判断の記録は [adr/backend/0006](../adr/backend/0006-host-backend-on-cloud-run-and-cloud-sql.md)。ここには手順だけを置く。

`gcloud` は justfile に載せず、ここのコマンドを devShell で直接実行する。プロジェクト ID、リージョン、Cloud SQL 接続名はこのファイルが正。

```sh
GCP_PROJECT=project-34107f2d-36dc-49d8-a58
GCP_REGION=asia-northeast1
GCP_SQL="$GCP_PROJECT:$GCP_REGION:times-db"
```

## 1. 初回だけ: 秘密と環境変数

秘密は Secret Manager に置く。

```sh
openssl rand -hex 32 | gcloud secrets create backend-token --data-file=- --project="$GCP_PROJECT"
printf '%s' '<本番 Client Secret>' | gcloud secrets create github-client-secret --data-file=- --project="$GCP_PROJECT"
```

`database-url` も同じ要領で作る (値は Cloud SQL コネクタの Unix socket を指す接続文字列)。

秘密でない値は Cloud Run のサービスに直接設定する。Cloud Run は環境変数を次のリビジョンへ引き継ぐので、デプロイのたびに渡さない。

```sh
gcloud run services update times-api --project="$GCP_PROJECT" --region="$GCP_REGION" \
    --update-env-vars=GITHUB_CLIENT_ID=<本番 Client ID>,ADMIN_GITHUB_LOGIN=<GitHub ユーザー名>
```

値を変えるときも同じコマンドを使う。`--set-env-vars` は指定しなかった変数を消すので使わない。

## 2. マイグレーション (変更があるときだけ、API より先に)

```sh
gcloud run jobs deploy times-migrate --source backend/db --project="$GCP_PROJECT" --region="$GCP_REGION" \
    --set-cloudsql-instances="$GCP_SQL" --set-secrets=DATABASE_URL=database-url:latest \
    --max-retries=0 --task-timeout=5m --args=up --execute-now --wait --quiet
```

- `up` 以外はカンマ区切りで渡す (`--args=down,1`、`--args=version`)
- Timeout (5m) を超えて kill されると dirty になる。`--args=version` で確認し、`--args=force,<直前の版>` で戻してから再実行

## 3. API

```sh
gcloud run deploy times-api --source backend --project="$GCP_PROJECT" --region="$GCP_REGION" \
    --set-cloudsql-instances="$GCP_SQL" \
    --set-secrets=DATABASE_URL=database-url:latest,BACKEND_TOKEN=backend-token:latest,GITHUB_CLIENT_SECRET=github-client-secret:latest \
    --update-env-vars=GIN_MODE=release --min-instances=0 --max-instances=2 --memory=256Mi \
    --allow-unauthenticated --quiet
```

## 4. frontend

```sh
just fe-deploy
```

Workers の変数はダッシュボードの Variables で管理する (`keep_vars = true` で deploy 時に保持)。

## 5. ログ

```sh
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="times-api"' \
    --project="$GCP_PROJECT" --limit=50 \
    --format="value(timestamp,jsonPayload.level,jsonPayload.msg,jsonPayload.method,jsonPayload.path,jsonPayload.status,jsonPayload.duration_ms,jsonPayload.err,textPayload)"
```
