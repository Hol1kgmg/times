# Quickstart: Digest のタイムライン

## 1. 自動チェック

```sh
just be-gen            # 差分を同じコミットに含める
just lint && just test # router テスト: 未ログインの /digests/published は 401
just fe-typecheck      # schemas.ts の satisfies が生成型と一致する
```

e2e は回さない ([research.md](./research.md) R6)。

## 2. 手動確認 (SQL の振る舞い)

前提: `just be-dev` が動いていて、開発用 DB `times` に管理者の公開の Digest が 3 件以上ある。管理者のセッショントークンを `TOKEN`、`backend/.env` の `BACKEND_TOKEN` を `BT` に入れる。

```sh
h() { curl -s -H "Authorization: Bearer $TOKEN" -H "X-Backend-Token: $BT" "http://localhost:8080/digests/published$1" | jq -c '[.digests[] | {entryDate, status, n: (.articles | length)}]'; }
psql_times() { docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d times -c \"$1\""; }
```

| # | 操作 | 期待 | spec |
|---|---|---|---|
| 1 | `h` | 日付の新しい順、最大 7 件、すべて `published` | US1-1, US1-6, FR-002 |
| 2 | `h '?limit=2'` | 新しい 2 件 | US1-2 |
| 3 | 2 の 2 件目の日付 `D` で `h "?before=D&limit=2"` | `D` より前の 2 件。`D` は含まない | US2-1 |
| 4 | 3 を空になるまで繰り返す | 公開の Digest の件数 (`psql_times "SELECT count(*) FROM digests WHERE status = 'published'"`) と、返った日付の合計件数が一致し、重複がない | US2-2, SC-002 |
| 5 | トップの応答と比べる: `diff <(curl -s -H "X-Backend-Token: $BT" localhost:8080/digests/latest \| jq -S .) <(curl -s -H "Authorization: Bearer $TOKEN" -H "X-Backend-Token: $BT" 'localhost:8080/digests/published?limit=1' \| jq -S '.digests[0]')` | 差分なし (形と記事の並びがトップと同じ) | US1-4, FR-007 |
| 6 | `h '?before=2999-01-01&limit=1'` | 最新の 1 件 | Edge Cases (未来の日付) |
| 7 | `h '?before=1900-01-01'` | `[]` | US2-4 |
| 8 | `h '?limit=0'` / `'?limit=32'` / `'?before=x'` (jq を外して) | 400 | FR-003, Edge Cases |
| 9 | `curl -s -H "X-Backend-Token: $BT" localhost:8080/digests/published` | 401 | US3-1 |
| 10 | 最新の公開の Digest を非公開にして `h '?limit=1'`、戻す | その Digest が出ず、戻すと出る | US1-6, Edge Cases |
| 11 | 管理者ではない作成者の公開の Digest を足す: `psql_times "INSERT INTO users (id, login) VALUES (-1, 'someone'); INSERT INTO digests (entry_date, created_by, status) VALUES ('2999-01-01', -1, 'published')"` → `h '?limit=1'` → 後片付け `psql_times "DELETE FROM digests WHERE created_by = -1; DELETE FROM users WHERE id = -1"` (id 1 は e2e の `octocat` が使っていることがある) | 2999-01-01 は出ない | US4-1, SC-005 |
| 12 | `backend/.env` の `ADMIN_GITHUB_LOGIN` を大文字に変えて backend を再起動し `h '?limit=1'`、戻す | 1 と同じ最新の 1 件 (セッションは残るので再ログイン不要) | US4-3 |
