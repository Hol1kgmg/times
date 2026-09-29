---
status: 'accepted'
date: 2026-09-26
decision-makers: 'Hol1kgmg'
---

# ログイン状態は backend が発行・照合し、信頼の起点を backend に置く

## Context and Problem Statement

[0003](0003-call-backend-from-server-functions-only.md) は認証を未決のまま残し、「必要になったとき、まず frontend のサーバー関数側で行う」と書いた。specs/003 (管理者ログイン) の最初の計画はこれに従い、GitHub OAuth の検証と暗号化 Cookie によるログイン状態を frontend (Workers) だけで完結させる案だった。

この案には構造上の弱点が 2 つある。

1. **backend は要求が管理者のものか判別できない。** backend が見るのは共有シークレット `X-Backend-Token` だけで、これは「Workers から来た」ことしか示さない。frontend のサーバー関数のどれか 1 つがガードを付け忘れれば、そこから backend への書き込みが素通りする。守りは 1 段しかない
2. **個別失効ができない。** ログイン状態がブラウザの Cookie にしか存在しないため、盗まれた 1 つだけを無効化する手段がなく、鍵を回して全員 (管理者 1 人だが) を失効させるしかない

将来 Digest に登録者 (`created_by`) を残す、ロールを足す、第 2 クライアントを出す、のいずれも「誰の要求か」を backend が知っていることを前提にする。

## Decision

**GitHub との本人確認、ログイン状態 (session) の発行・照合・失効を backend が行う。frontend は識別子を運ぶだけにする。**

- GitHub OAuth の `code` は frontend が受け取り、そのまま backend の `POST /auth/sessions` に渡す。backend が GitHub と token を交換し、`GET /user` で固定 ID とユーザー名を得て、許可ユーザー名 (backend の環境変数 `ADMIN_GITHUB_LOGIN`) と照合する。GitHub の Client Secret は backend だけが持つ
- 成立したら `users` に upsert し、`sessions` に行を作り、ランダムな不透明トークンを返す。DB にはトークンの SHA-256 だけを置く。有効期限はログインから 30 日固定
- frontend はトークンを HttpOnly Cookie に入れ、backend を呼ぶときに `Authorization: Bearer` で転送する。frontend はトークンの中身を解釈しない
- 管理者専用の操作は `openapi.yaml` で `security: [bearerAuth]` を宣言する。照合は `OapiRequestValidator` の `AuthenticationFunc` で行い、宣言のある操作だけがトークンを要求する。handler は context から user を受け取る
- 共有シークレット `X-Backend-Token` ([0006](0006-host-backend-on-cloud-run-and-cloud-sql.md)) は維持する。役割が違う: 共有シークレットは「frontend からの要求」、session は「管理者の要求」を示す。ブラウザから backend へ直接到達する経路は引き続き作らない (0003 の主決定は変えない)
- ログアウトは `DELETE /auth/sessions/current`。運用側の個別失効は `sessions` の行削除

**採らないもの**

- ロール列。管理者 1 人で「ログインが成立する = 管理者」なので、`users.role` は 2 種類目が出るまで置かない
- JWT などの自己完結トークン。DB を引かずに検証できるが、個別失効ができず、この ADR の動機の半分を捨てる。要求ごとの `sessions` 1 行の索引参照は Cloud SQL で問題にならない
- backend が OAuth の redirect 先になること。ブラウザが backend に到達する必要が生じ、0003 を壊す

## Consequences

- Good, because backend が要求ごとに自分で照合する。frontend のガード漏れは backend の 401 で止まる (fail-closed)
- Good, because `sessions` の行削除で個別失効ができる。`created_by` は `users` への外部キーになる
- Good, because ロール、第 2 クライアント、監査ログを足すときに認証基盤を作り直さない
- Good, because frontend から認証ロジックがほぼ消える。暗号化 Cookie も鍵も要らない
- Bad, because backend に `users` / `sessions` のマイグレーション、`/auth/sessions` の 3 操作、GitHub 呼び出し、環境変数 3 つが増える。backend の環境変数は `DATABASE_URL` / `PORT` / `BACKEND_TOKEN` に加えて `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `ADMIN_GITHUB_LOGIN` になる (docs/tech-stack.md と constitution の記述を更新する)
- Bad, because 管理者向けページの表示ごとに Workers → backend の照合が 1 回乗る。書き込み系の操作は backend 呼び出しに同乗するので追加コストなし
- Bad, because backend が GitHub に到達できる必要がある。Cloud Run からの外向き通信は既定で可能

## Implementation Plan

specs/003 の plan.md / tasks.md で行う。

- **Affected paths**:
  - `backend/db/migrations/000003_create_users_and_sessions.*.sql` (新規)
  - `backend/db/queries/auth.sql` (新規): user upsert、session 作成・照合・削除・期限切れ削除
  - `backend/api/openapi.yaml`: `securitySchemes.bearerAuth`、`/auth/sessions` (POST)、`/auth/sessions/current` (GET / DELETE)、`Problem.type` に `/problems/forbidden` と `/problems/upstream-failed`
  - `backend/internal/apperr/apperr.go`: `Forbidden`、`UpstreamFailed`
  - `backend/internal/auth/` (新規): GitHub クライアント、トークン生成とハッシュ
  - `backend/cmd/server/main.go`: `AuthenticationFunc` の配線、環境変数の読み取り
  - `backend/internal/handler/`: `CreateSession` / `GetCurrentSession` / `DeleteCurrentSession`
  - `frontend/src/shared/api/backend.server.ts`: Bearer の転送と、401 を `SESSION_EXPIRED` に写す
  - `frontend/src/shared/auth/`、`frontend/src/pages/admin-login/`、`frontend/src/app/routes/`
  - `docs/tech-stack.md`: backend の環境変数
- **Dependencies**: 追加なし。GitHub 呼び出しは `net/http`、トークンは `crypto/rand` + `crypto/sha256`
- **Patterns to follow**:
  - 照合は `AuthenticationFunc` に集約し、handler で `Authorization` ヘッダを読まない。framework に触るのは `newRouter` だけ ([0001](0001-adopt-gin-behind-oapi-codegen-strict-server.md))
  - 拒否は `apperr` を経由して Problem Details にする ([0002](0002-return-errors-as-rfc9457-problem-details.md))
  - DB にはトークンのハッシュだけを置く。平文トークンはレスポンスに 1 回出すだけで、ログにも出さない
  - GitHub のベース URL は環境変数で差し替え可能にし、テストでは `httptest.Server` に向ける
- **Patterns to avoid**:
  - frontend が GitHub と token 交換を済ませ、user 情報だけを backend に送る (backend が frontend の申告を信じる構図に戻る)
  - `X-Backend-Token` を外す (到達制限は別の層)
  - session をリクエストごとに延長する (spec FR-007: 30 日固定)

### Verification

2026-09-29 確認 (`backend/internal/handler/auth_test.go`、`backend/cmd/server/main_test.go`、`frontend/e2e/admin-login.spec.ts`):

- [x] `POST /auth/sessions` に許可ユーザー名の GitHub 応答 (httptest) で 201、`users` と `sessions` に 1 行ずつ
- [x] 別ユーザー名なら 403 `/problems/forbidden`、`users` に行が増えない
- [x] `GET /auth/sessions/current` がトークンなし・不正・期限切れで 401 `/problems/unauthorized`、有効なら 200
- [x] `DELETE /auth/sessions/current` が 2 回連続で成功し、以後の GET が 401 (handler test で存在しない hash も 204。e2e で削除後の別コンテキストがログインカードに戻る)
- [x] `security` を宣言していない操作 (`/health`) はトークンなしで通る
- [x] frontend の e2e で、ログイン〜ログアウト〜再訪が backend 経由で通る (GitHub はモック)

## Alternatives Considered

- **frontend 完結 (暗号化 Cookie、最初の案)**: コードは最小だが上記 2 つの弱点を持つ。管理者 1 人の現状では動くものの、`created_by` やロールを足す段になって作り直しになる
- **frontend が検証し、user 情報をヘッダで backend に渡す**: `users` テーブルは作れるが、backend はヘッダを信じるしかない。fail-closed にはなるが信頼の起点は frontend のまま
- **JWT (署名付き自己完結トークン)**: DB を引かずに済むが個別失効ができない。`sessions` 1 行の参照コストは問題にならない規模

## More Information

- 関連: [0003](0003-call-backend-from-server-functions-only.md) の「認証・認可は未決」を本 ADR で決めた。0003 の主決定 (backend はサーバー関数からだけ呼ぶ) は変わらない
- 関連: [0006](0006-host-backend-on-cloud-run-and-cloud-sql.md) の共有シークレットは維持
- 仕様: specs/003-admin-login/spec.md (FR-015, FR-019, SC-010)
- 再検討条件: 管理者が複数になりロールが要る (`users.role` を足す)、第 2 クライアントが出る (0003 の supersede と合わせて session の受け渡し方を見直す)
