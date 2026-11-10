# Quickstart: 匿名 ID で記事別 UU・サイト UU・DAU・MAU を数える

指標の定義、GA4 での出し方、制約は `docs/analytics.md` (本機能で作る) が正。ここは確認の手順だけを置く。

## 事前準備 (デプロイ前、GA4 コンソール)

1. 管理 → レポート用識別子 → 「デバイスベース」にする。
2. 管理 → Google シグナル → 無効のままか確かめる。
3. 管理 → データの保持 → 今の期間 (2 か月 / 14 か月) を確かめ、`docs/analytics.md` に書き写す。14 か月にするかは決めて書く。
4. 管理 → プロパティの詳細 → タイムゾーンを確かめ、`docs/analytics.md` に書き写す。
5. specs/013 のカスタム ディメンション (`article_id` / `article_url` / `digest_date`) が登録済みか確かめる。

## ローカルの確認

```sh
just lint && just test      # 匿名 ID の再利用・作り直し・保存できないとき、受付の合併・UUID・4 KB・クエリ落とし (Vitest)
just fe-typecheck
just fe-test-e2e digest-new # トップを開くと page_view、記事を押すと article_click が同じ clientId で飛ぶ
```

e2e は `.agents/rules/quality.md` の手順で backend を `be-dev-e2e` に切り替えて回す。

`just fe-dev` で手で確かめること:

| 確認 | 手順 | 期待 |
|---|---|---|
| 初回の 1 件 | DevTools の Network を開いて `/` を読み込む | `/open` の `page_view` が 1 件 (Strict Mode でも 1 件) |
| 遷移 | サイドバーから `#timeline` へ移る | `page_view` が 1 件増え、`title` が `#timeline | …` |
| 管理画面 | 記事の登録・編集・ログインの画面を開く | `/open` が飛ばない |
| クエリ | `/?utm_source=x` を開く | 本文の `location` にクエリがない |
| 保存できない | Safari のプライベートウィンドウか、DevTools で localStorage を壊す | 画面も記事のタブも普段どおり。同じページの中では `clientId` が変わらない |

## デプロイ後の実測 (spec SC-002、結果を `docs/analytics.md` に書く)

1. ブラウザ A (例: Chrome) でトップを開き、記事 X を 2 回押す。
2. ブラウザ B (例: Firefox) でトップを開き、記事 X を 1 回押す。
3. ブラウザ C (例: Safari) でトップを開くだけにする。
4. 翌日以降 (集計が反映された後) に探索で次を出す ([data-model.md](./data-model.md) の「指標」)。

| 指標 | 期待 |
|---|---|
| 記事 X のイベント数 | 3 |
| 記事 X の総ユーザー数 | 2 |
| `page_view` の総ユーザー数 (その日) | 3 (ほかの読み手の分を除いて読む。少ない日に行う) |
| 同じ日の「アクティブ ユーザー数」 | 記録するだけ (R4: `engagement_time_msec` で出るかを見る) |
| `デバイス カテゴリ` | specs/013 R1 の未確定もここで見る |

合わなければ、どこが合わなかったかと research R7 の代わりの方法を `docs/analytics.md` に書く。
