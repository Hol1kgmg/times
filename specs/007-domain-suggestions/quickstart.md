# Quickstart: ドメイン候補

## 1. 自動チェック

```sh
just be-gen            # 差分を同じコミットに含める
just lint && just test # router テスト: 2 つの経路とも未ログイン 401、limit=51 で 400
just fe-typecheck      # schemas.ts の satisfies が生成型と一致する
```

e2e は回さない ([research.md](./research.md) R5)。

## 2. 手動確認 (SQL の振る舞い)

前提: `just be-dev` が動いていて、開発用 DB `times` に記事が登録済み。管理者のセッショントークンを `TOKEN` に入れる (ログイン後の Cookie の値)。backend は `X-Backend-Token` も要るので `backend/.env` の値を `BT` に入れる。

```sh
# 全件 (US1〜3) は h /all、公開分 (US4) は h ''
h() { curl -s -H "Authorization: Bearer $TOKEN" -H "X-Backend-Token: $BT" "http://localhost:8080/articles/domains$1$2"; echo; }
```

### 全件 (`/articles/domains/all`)

| # | 操作 | 期待 | spec |
|---|---|---|---|
| 1 | `h /all` | 件数の多い順、同数はドメイン名順。最大 20 件 | US1-1, US1-2, US2-3 |
| 2 | `h /all '?q=ZEN'` | `zenn.dev` だけ | US2-1, US2-2 |
| 3 | `h /all '?q=%25'` (`%`) | 空の一覧 (全件にならない) | Edge Cases |
| 4 | `h /all '?q=nomatch'` | `{"domains":[]}` | US2-5 |
| 5 | `h /all '?limit=5'` | 5 件 | US2-4 |
| 6 | `h /all '?limit=0'` / `'?limit=51'` / `'?limit=a'` | 400 | FR-004 |
| 7 | `curl -s -H "X-Backend-Token: $BT" localhost:8080/articles/domains/all` | 401 | US3-1 |
| 8 | 下書きの Digest に新しいドメインの記事を足してから `h /all` | そのドメインが入っている | US1-3, SC-002 |
| 9 | 記事数と突き合わせる: `docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d times -c "SELECT count(*) FROM articles"'` | ドメインが 50 種類以下なら、`h /all '?limit=50'` の `count` の合計と一致 | FR-001, FR-008 |

### 公開分 (`/articles/domains`)

| # | 操作 | 期待 | spec |
|---|---|---|---|
| 10 | 8 の記事を残したまま `h '' '?q=<8 のドメイン>'` | 空の一覧 (下書きの記事は数えない) | US4-2, US4-3, SC-005 |
| 11 | 公開の記事数と突き合わせる: `... -c "SELECT count(*) FROM articles a JOIN digests d ON d.id = a.digest_id WHERE d.status = 'published'"` | `h '' '?limit=50'` の `count` の合計と一致 | US4-1, FR-010 |
| 12 | `h '' '?q=ZEN&limit=5'`、`h '' '?limit=51'` | 絞り込みと件数の上限は全件と同じ。51 は 400 | US4-5 |
| 13 | `curl -s -H "X-Backend-Token: $BT" localhost:8080/articles/domains` | 401 | US4-4 |
| 14 | 公開の Digest を 1 つ非公開にして `h '' '?limit=50'`、戻す | その Digest の記事が件数から外れ、戻すと元に戻る | US4-6 |
