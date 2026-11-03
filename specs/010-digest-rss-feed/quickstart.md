# Quickstart: Digest の公開を知らせる RSS フィード

## 前提

- `just db-up` 済み (migrate が 000011 まで当たる)
- `just be-dev` と `just fe-dev` が動いている (URL は fe-dev の表示に従う。以下 `localhost:3000` と書く)

## 1. 下書きを公開すると通知が載る (US1)

1. 管理者でログインし、今日以前の日付の Digest を下書きで登録する
2. `http://localhost:3000/feed.xml` を開く → item が増えていない
3. 編集画面で「公開して保存」する
4. もう一度開く → 先頭に `<日付>の times 投稿が公開されました` の item があり、`pubDate` が今の時刻
5. item の画像 URL を開く → 中央に日付が入った 1200×630 の PNG が出る

dev (Node) には Cache API がないので即時に反映される。Workers では最大 300 秒遅れる。

## 2. 公開し直しでは通知しない (US2)

1. 1 の Digest を非公開にして保存 → feed から item が消える
2. 公開に戻す → item が同じ guid・同じ pubDate で戻る

## 3. 未来の日付は公開できない (US3)

1. 明日の日付で「公開して登録」→ 日付欄が赤くなり、登録されない
2. 同じ日付で「下書きで登録」→ 登録できる
3. 公開の Digest の日付を明日に変えて保存 → 断られる

## 4. 日ごとのページ

1. 1 の item の `link` (`/digest/<日付>`) を開く → すぐトップに移る
2. `curl -s localhost:3000/digest/<日付>` → 200 で、`og:image` が `/feed/images/<日付>.png?v=1`、`robots` が `noindex`

## 5. 対象外の日付

- 下書きの日付・存在しない日付で `/feed/images/<日付>.png` と `/digest/<日付>` を開く → どちらも 404。backend のアクセスログに出ない
- `/feed/images/<載っている日付>.png?x=1` → 画像が返る (キーは日付だけ)

## 6. WAF のレート制限 (本番、ブラウザで操作)

1. Cloudflare ダッシュボード → z-times.dev → Security → WAF → Rate limiting rules
2. 既存の `/_serverFn/` のルールを編集し、式に `or starts_with(http.request.uri.path, "/feed") or starts_with(http.request.uri.path, "/digest/")` を足す
3. 保存後、`/feed.xml` を 10 秒に 31 回以上取ると 429 になることを確かめる

## 自動の確認

```sh
just be-gen && just lint && just test && just fe-typecheck
just fe-test-e2e digest-edit   # UpdateDigest の SQL を変えるため
just fe-test-e2e digest-new    # CreateDigest の SQL を変えるため
```

e2e の backend の切り替えは `.agents/rules/quality.md` の手順に従う。
