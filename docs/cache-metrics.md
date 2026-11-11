# キャッシュの効率 (Workers Logs)

Workers の Cache API (adr/frontend/0002) がどれだけ backend を守れているかを、Workers Logs だけで見る。追加のサービスや課金は無い。経緯は issue #140。

## 出しているログ

`console.log` にオブジェクトを渡しているので、Workers Logs がフィールドごとに索引を作る。

| ログ | 出す場所 | フィールド |
|---|---|---|
| キャッシュ | `shared/api/cache.server.ts` (`cachedJson` / `cachedResponse`) | `cache` (`hit` / `miss`)、`endpoint` (キーの先頭 2 段: `/digests/latest`、`/preview/v3`、`/feed`、`/feed/images` など)、`ms` (miss のときの取得時間) |
| backend | `shared/api/backend.server.ts` (`backendFetchRaw`) | `backend` (`GET /digests/latest` のようにメソッドとパス。クエリは出さない)、`status`、`ms` |

- IP・UA・Cookie・トークンは出さない。Workers の自動のリクエストログ (IP・位置・ヘッダを含む) は `wrangler.toml` の `invocation_logs = false` で止めている。
- BYPASS は「キャッシュのログが付かない backend 呼び出し」。管理者の全期間や書き込みがこれにあたる。
- `/preview/v3` の miss は外部サイトへの fetch で、backend には届かない。

## 見方

Cloudflare ダッシュボード → Workers & Pages → `times` → Observability → Query Builder。期間は保持期間の 7 日以内で選ぶ。

| 知りたいこと | Filter | Group by | 値 |
|---|---|---|---|
| エンドポイント別のヒット率 | `cache` exists | `endpoint`、`cache` | Count |
| backend への到達数 | `backend` exists | `backend` | Count |
| backend の応答時間 | `backend` exists | `backend` | P50 / P99 (`ms`) |
| miss のときの待ち時間 | `cache` = `miss` | `endpoint` | P50 / P99 (`ms`) |
| BYPASS | `backend` exists、`backend` が上のキャッシュ対象のパス以外 | `backend` | Count |

Cloud SQL の負荷は GCP コンソールの Cloud SQL → `times` の CPU 使用率・接続数を、同じ期間で見比べる。

## 判断の目安

- ヒット率の目標値は決めていない。backend の到達数が Cloud Run の無料枠 (月 200 万リクエスト) に対して小さく、Cloud SQL の CPU に張り付きが無ければ、miss が多くても直さない。
- Cache API はデータセンター単位なので、閲覧が少ないうちは TTL 5 分のキーはほぼ当たらない。ヒット率が低いことだけを理由に TTL を延ばさない。
- 直すのは、到達数か応答時間が費用・体感に出たとき。候補は TTL の延長、キーの統合、min instances 1 (adr/frontend/0002 と issue #135 の再検討条件)。

## 計測のコスト

- Workers Paid は月 2,000 万件のログを含み、超えた分は 100 万件あたり $0.60。1 リクエストで出るのは数行で、月数万リクエストなら含まれる量の 1% に満たない。
- 増えすぎたら `wrangler.toml` の `[observability]` の `head_sampling_rate` を下げる。下げたら件数はその割合で割り戻して読む。
