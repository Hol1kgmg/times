---
status: 'accepted'
date: 2026-09-22
decision-makers: 'Hol1kgmg'
---

# backend は frontend のサーバー関数からだけ呼び、ブラウザには公開しない

## Context and Problem Statement

frontend（TanStack Start、Cloudflare Workers）と backend（Go、Docker）はまだ繋がっていない。`frontend/src/shared/api/db.server.ts` はインメモリの固定データを返している。

繋ぐ前に「誰が backend を呼ぶか」を決める必要がある。これで次の3つが同時に決まる。

- CORS の要否
- 認証を置く場所（backend か、frontend のサーバー側か）
- backend をインターネットに公開するか

呼び出し経路は2つある。

1. ブラウザが backend を直接叩く。backend に CORS と認証が必要になり、インターネットに公開される
2. TanStack Start のサーバー関数（`createServerFn`）が backend を叩く。ブラウザは frontend のサーバーとしか話さない

frontend は既に `.server.ts` + `createServerOnlyFn` でサーバー専用境界を持っている（`shared/api/db.server.ts`）。経路 2 はこの境界をそのまま使える。

## Decision

**経路 2 を採る。** backend を呼ぶのは frontend のサーバー関数だけで、ブラウザは backend の URL を知らない。

- backend は CORS を設定しない。ブラウザからのクロスオリジン要求は来ない前提
- backend の URL は frontend のサーバー側環境変数で渡す。クライアントバンドルに含めない
- API の型は `backend/api/openapi.yaml` から生成する。frontend を繋ぐときに `openapi-typescript` を `just be-gen` に組み込み、生成物を `frontend/src/shared/api/` に置く
- API バージョニングはしない。`/v1` のような prefix を付けず、破壊的変更は frontend と同時にデプロイして吸収する。クライアントが frontend のサーバー関数だけなので、複数バージョンを同時に生かす必要が無い

**未決のまま残すもの**

- 認証・認可。現時点で不要。必要になったとき、まず frontend のサーバー関数側で行い、backend にはサーバー間の共有シークレットか private network で到達制限をかける。backend にユーザー認証を実装するのは、ブラウザ直叩きが必要になったときだけ
- backend のホスティング先。Dockerfile はあるが、どこで動かすかは決めていない。経路 2 なら「Workers から到達できる」以外の制約が無い

## Consequences

- Good, because backend に CORS・認証・rate limit が要らない。攻撃面が frontend のサーバー関数に集約される
- Good, because 既存のサーバー専用境界（`.server.ts`）をそのまま使える
- Good, because API の破壊的変更を frontend と一緒に出せる。バージョニングの運用が要らない
- Bad, because 毎リクエストが Workers → backend の1ホップ増える。レイテンシは Workers のリージョンと backend の距離で決まる
- Bad, because モバイルアプリ等の第2クライアントが出たら、この決定は成り立たない。そのとき CORS と認証を backend に足し、この ADR を supersede する

## Implementation Plan

現行コードは既にこの決定に従っている（backend に CORS が無い）。frontend を繋ぐときの規約として書く。

- **Affected paths**: `frontend/src/shared/api/`（サーバー関数と生成型）、`justfile`（`be-gen` に TS 生成を追加）、`backend/cmd/server/main.go`（CORS を足さないこと）
- **Dependencies**: `openapi-typescript`（frontend を繋ぐときに追加。今は入れない）
- **Patterns to follow**:
  - backend を呼ぶコードは `*.server.ts` に置き、`createServerOnlyFn` か `createServerFn` で包む
  - backend の URL は `process.env` / Workers の binding から読む。`VITE_` prefix の環境変数（クライアントに露出する）に置かない
- **Patterns to avoid**:
  - ブラウザから `fetch("http://backend/...")` する
  - backend に `gin-contrib/cors` を足す
  - `/v1/` prefix を付ける

### Verification

- [x] `backend/cmd/server/main.go` に CORS middleware が無い
- [x] `openapi.yaml` の paths に version prefix が無い
- [x] frontend 接続時: `grep -r "8080\|BACKEND_URL" frontend/src --include='*.tsx' --include='*.ts' | grep -v '\.server\.ts'` が何も返さない

## Alternatives Considered

- **ブラウザから直接叩く**: Workers のホップが消えて速い。しかし CORS・認証・rate limit を backend に実装してから公開する必要があり、まだ認証を決めていない今は選べない。第2クライアントが出たときの再検討先
- **backend を Workers に統合する（Go を捨てる）**: ホップも CORS も消える。しかし Go + Postgres の構成は決定済みで（`docs/tech-stack.md`）、この ADR の範囲外

## More Information

- 関連: [HTTP framework に Gin を採用し、oapi-codegen strict-server の下に隠す](0001-adopt-gin-behind-oapi-codegen-strict-server.md)（CORS を足すとしたら `newRouter`）
- 再検討条件: ブラウザ以外のクライアントが出たとき、または Workers のホップが計測上のボトルネックになったとき
- 2026-09-24: ホスティング先は [0006](0006-host-backend-on-cloud-run-and-cloud-sql.md) で Cloud Run + Cloud SQL に決めた
- 2026-09-22: 「型は openapi.yaml から生成する」の具体化は [frontend/0001](../frontend/0001-generate-api-types-and-hand-write-branded-zod-schemas.md) に記録した
