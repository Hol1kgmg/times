# Quickstart: 記事リンクのクリック数を記事ごとに数える

## 事前準備 (デプロイ前、GA4 コンソール)

1. 管理 → データストリーム → 対象の web ストリーム → Measurement Protocol API secret を作る。
2. 管理 → カスタム定義 → カスタム ディメンションを作る (範囲はイベント): `article_id` / `article_url` / `digest_date`。登録より前のイベントは集計されない。
3. Workers ダッシュボードの Variables に `GA_MEASUREMENT_ID` (Variable)、`GA_API_SECRET` (Secret) を入れる。

## ローカルの確認

```sh
just lint && just test      # 受付の検証・bot 除外・URL の切り詰め・端末の分類 (Vitest)
just fe-typecheck           # プレビューに onOpen を渡すと型エラーになること
just fe-test-e2e digest-new # 登録 → トップで記事を押すと POST /open が記事の id で飛ぶ
```

e2e は `.agents/rules/quality.md` の手順で backend を `be-dev-e2e` に切り替えて回す。ローカルでは測定 ID が空なので、受付は 204 を返して GA4 には送らない。

## デプロイ後の確認 (spec の完了条件)

| 確認 | 手順 | 期待 |
|---|---|---|
| PC・モバイルで届く | PC とスマホ実機でトップの記事を押す | GA4 のリアルタイム / DebugView に `article_click` が出る |
| 中クリック | PC で記事を中クリック | 1 件届く |
| href | 記事を右クリック → リンクのアドレスをコピー | 記事の元の URL |
| ブロッカー | uBlock Origin (既定のフィルタ) を有効にして押す | 届く。DevTools の Network で `/open` が 204 |
| プレビュー | 編集画面のプレビューで記事を押す | `/open` への通信がない |
| id が変わらない | Digest を編集して保存し、同じ記事を押す | 保存前と同じ `article_id` |
| 記事ごとの回数 | 探索 (自由形式): 行 `article_url`、値 イベント数、フィルタ イベント名 = `article_click` | 記事ごとの回数が出る |
| 端末 (R1 の未確定) | 同じ探索に `デバイス カテゴリ` を足す | mobile / desktop が分かれる。出なければ `device` を外す |
