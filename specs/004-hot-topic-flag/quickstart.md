# Quickstart: ホットトピックをカテゴリから記事のフラグへ移す

## ローカルでの確認

前提: devShell と compose が使えること (README.md)。

1. 移行前のデータを用意する: `main` で `just db-up` → `just db-seed` (旧 seed は「ホットトピック」見出しを含む)
2. 本ブランチに切り替え、`just db-up` で migration 000006 を流す
3. US3 の確認: backend (`just be-dev`) と frontend を起動してトップを開き、旧「ホットトピック」の記事が「その他」の区画に炎の印付きで出ること、記事数と並びが移行前と同じことを見る
4. `just db-seed` で新しい seed を入れ直し、ホットトピックの記事が本来のカテゴリ (例: `IT系`) の区画に炎の印付きで出ること、ホバーで HOT が出ることを見る
5. down の確認: migration を 1 つ戻し (`just db-migrate down 1`)、旧 7 カテゴリの CHECK で起動し直せることを見る。確認後に up し直す

## 完了の判定 (rules/quality.md)

```sh
just be-gen            # openapi.yaml と SQL を変えるので必須。差分は同じコミットに含める
just lint && just test
just fe-typecheck
just fe-test-e2e       # 登録フォームに触れるので必須
```

## 本番の移行

1. デプロイで migration 000006 が流れる。本番の Digest は表示され続け、ホットトピックの記事は「その他」の区画に炎の印付きで出る
2. 管理者でログインし、記事を登録の画面で、同じ日付の Digest を本来のカテゴリと「ホット」の印を付けて登録し直す
3. トップで、ホットトピックの記事が本来のカテゴリの区画に移ったことを見る
