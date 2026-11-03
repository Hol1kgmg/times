# Research: Digest のタイムライン

## R1. パスは `/digests/published`、operationId は `listPublishedDigests`

- **Decision**: `GET /digests/published?before=&limit=`。応答は `{ "digests": Digest[] }` (`DigestPage`)
- **Rationale**: 返すのは公開の Digest の列なので `/digests` の下に置き、絞り込みの条件 (公開) をパスで表す。gin は静的な `/digests/published` を `/digests/{entryDate}` より優先する (既存の `/digests/latest` と同じ)。包みは既存の `DigestList` (`digests`) に揃える
- **Alternatives considered**:
  - `/digests/timeline`: 使い道 (画面) に縛られる。007 R6 と同じ理由で避ける
  - `GET /digests?status=published&before=`: 既存の `listDigests` は記事を含まない日付一覧で、ステータスを問わない管理者向けの操作。応答の形が変わるので同じ操作にしない

## R2. 管理者の Digest への絞り込みは `users.login` との比較で SQL に置く

- **Decision**: `created_by IN (SELECT id FROM users WHERE lower(login) = lower(@admin_login))`。handler は既に持っている `s.adminLogin` を渡す
- **Rationale**: 管理者の判定をログインの許可 (`strings.EqualFold(u.Login, s.adminLogin)`、`handler/auth.go`) と同じ規則にする (FR-010)。求めた本人の `Principal.UserID` では絞らない。`adminLogin` が空なら `users.login` の CHECK (`login <> ''`) によって一致する行がなく、分岐なしで空の一覧になる (US4-3)
- **Alternatives considered**:
  - `Principal.UserID` で絞る: 今は結果が同じだが、一般ユーザーを足すと本人の Digest になり FR-010 に反する
  - 管理者の GitHub ID を環境変数で持つ: 設定が 1 つ増える。今の判定がユーザー名なので揃える
  - `users.login` に UNIQUE: 空いた旧名を取った人のログイン (upsert) が失敗する。spec Assumptions のとおり重複は受け入れ、SQL に `ponytail:` コメントで上限を残す

## R3. 続きは `before` (その日付を含まない) によるキーセット

- **Decision**: `sqlc.narg(before)::date IS NULL OR entry_date < sqlc.narg(before)`、`ORDER BY entry_date DESC LIMIT @lim`
- **Rationale**: 作成者が 1 人に絞られ、`UNIQUE (created_by, entry_date)` (migration 000008) で日付が一意なので、日付だけを起点にしても重複・抜けがない (US2-2)。オフセットと違い、途中で新しい登録があってもずれない (US2-5)。同日の並びの規則 (`created_at`) は要らない
- **Alternatives considered**:
  - `offset`: 読み足す間に登録があるとずれる
  - 応答に `nextBefore` を持たせる: 前回の最後の `entryDate` と同じ値で、件数が `limit` 未満なら終わり (US2-3) と分かるので要らない

## R4. 記事は Digest ごとに既存の `withArticles` で読む

- **Decision**: Digest の一覧を 1 クエリで取り、それぞれに既存の `s.withArticles(ctx, d)` を呼ぶ。新しいクエリは Digest の一覧の 1 本だけ
- **Rationale**: 記事・リンクの取得と変換 (`toDigest`) はトップと同じものをそのまま使え、FR-007 (トップと同じ形と並び) を新しいコードなしで満たす。既定 7 件で 1 + 14 クエリ、上限 31 件でも 63 クエリで、数 ms ずつなら SC-003 (1 秒未満) に収まる。`ponytail:` コメントで上限を残す
- **Alternatives considered**:
  - `digest_id = ANY(...)` で記事とリンクをまとめて 2 クエリで取り、Go で Digest ごとに振り分ける: クエリ 2 本 + 振り分けの関数 + その単体テストが増える。`toDigest` に他の Digest のリンクを渡すと `make` の容量が負になって panic するので、振り分けは省けない。遅くなったら切り替える
  - 1 クエリで JSON を組み立てる (`json_agg`): 変換が SQL と Go に分かれ、トップと同じ形である保証がなくなる

## R5. `limit` は 1〜31、既定 7。形は OpenAPI で弾く

- **Decision**: `limit` は `integer` / `minimum: 1` / `maximum: 31` / `default: 7`、`before` は `string` / `format: date`。validator が 400 (`validation-failed`) にする
- **Rationale**: quality.md「形式は openapi.yaml、handler で再検証しない」。`default` は oapi-codegen が埋めないので、handler で nil のときに 7 を使う (007 の `articleDomains` と同じ)。31 は 1 か月分で、R4 のクエリ数の上限にもなる
- **Alternatives considered**: 未来の `before` を拒否する: 結果は最新からと同じで害がない (spec Edge Cases)

## R6. テストは router の 1 行だけ

- **Decision**: `TestRouter` に「未ログインの `GET /digests/published` は 401」を足す
- **Rationale**: quality.md「操作を足したら router テスト 1 件」「DB に接続するテストは書かない」。handler は既定値の 1 行を除いて分岐がなく、記事の変換は既存の `toDigest` のまま。SQL の振る舞い (公開・管理者・並び・`before`) は quickstart の手動確認で見る
- **Alternatives considered**:
  - `limit=32` で 400: validator の振る舞いで、007 で同じ形を押さえている
  - e2e 1 本: 使う画面がまだない。画面を作る機能で 1 本書く (007 R5 と同じ)

## R7. サーバー関数は `requireAdminToken` で呼び、キャッシュを通さない

- **Decision**: `listPublishedDigests` を `shared/api/list-published-digests.ts` に置き、入力 `{ before?: 日付, limit?: 1〜31 }` を zod で検証する。`backendFetch` に `token: requireAdminToken()` を渡す
- **Rationale**: 今ログインできるのは管理者だけで、007 の `listArticleDomains` と同じ形 (`ponytail:` で一般ユーザーのトークンへの差し替えを残す)。呼ぶのはログインした 1 人なので、トップのキャッシュ (adr/frontend/0002) の効果がない
- **Alternatives considered**: トップと同じキャッシュを通す: 公開になった Digest の反映が遅れ、効果もない。一般ユーザーが増えたら見直す
