---
status: 'accepted'
date: 2026-10-18
decision-makers: 'Hol1kgmg'
---

# backend の読み取り結果とリンクプレビューは Workers の Cache API に載せ、backend にはキャッシュを置かない

## Context and Problem Statement

公開ページ `/` は毎リクエストで Workers → Cloud Run → Cloud SQL まで往復して `GET /digests/latest` を取り、さらに記事ごとに外部サイトの HTML (最大 1 MiB) を取りに行って og タグを読む。どこにもキャッシュが無い。

一方でデータは滅多に変わらない。Digest は管理者が手動で `POST /digests` したときだけ増え、登録後に編集されることもほぼ無い。cron も無い。「数日に 1 回しか変わらないものを毎回取りに行く」構成になっている。

制約:

- Cloud Run は min instances 0 (adr/backend/0006)。インスタンスが消えるので、Go プロセス内のメモリキャッシュは効かない
- 月額の目安は $11〜16。Redis / Memorystore / KV のような有料の中間層は入れたくない
- backend は Workers のサーバー関数からしか呼ばれない (adr/backend/0003)。キャッシュを置く場所は Workers 側で完結できる
- Cloud Run は Cloudflare の proxy 配下ではないので、`fetch` の `cf.cacheTtl` は使えない。明示的に Cache API を使う

## Decision

**Workers の Cache API (`caches.open("times")`) に載せる。backend は無状態のまま、キャッシュ用のヘッダも持たせない。**

- `GET /digests/latest` の結果: TTL 5 分。RSS (`/feed`) と RSS の画像 (`/feed/images/{date}`) も同じ 5 分
- Digest の保存 (登録・編集) に成功したら、サーバー関数が最新の Digest・RSS・保存した日付の RSS 画像を `delete` する (2026-11-21、issue #116)。編集で日付を変えたときは前後の両方の日付を消す。公開中の Digest の誤字を直したら、管理者の手元ですぐ確かめたいため
  - 消えるのは保存を受けたデータセンターの分だけ。ほかの地域の読み手には最大 5 分の遅れが残ることを許容する。全地域で消すには Cache API をやめて、ゾーンのキャッシュと Purge API に移す必要がある
  - 消す処理が失敗しても保存は成功として返す。キャッシュは TTL で切れるため
- リンクプレビュー (`getLinkPreview`): 成功は 1 日、失敗 (`null`) も 1 時間キャッシュして、壊れた URL を毎回取りに行かない
  - 受け付けるのは最新 Digest (キャッシュ済み) に載っている URL だけ。それ以外は取りに行かず `null` を返す (2026-10-22)。公開エンドポイントなので、任意の URL を受けると URL を変えるだけでキャッシュを外され、クローラーや踏み台利用で外部 fetch が青天井になる
- SSR の HTML そのものはキャッシュしない。ヘッダにログイン状態が出るため
- キャッシュキーに共有シークレット (`X-Backend-Token`) を含めない。backend の URL だけで作る
- ローカル (`vite dev`、Node) では `caches` が無いので、無ければ素通しにする

## Consequences

- Good, because Cloud Run / Cloud SQL への到達がほぼアクセス数に比例しなくなる。min instances 0 のままで済む
- Good, because 外部サイトへの fetch が記事 × 閲覧者 から 記事 × 日 に減る。コストの重心はここだった
- Good, because 追加のサービスも課金も無い。コードは Workers のヘルパー 1 つ
- Bad, because Cache API はデータセンター単位で、保持も保証されない。ヒット率は閲覧者の地域に依る。個人サイトの規模では問題にしない
- Bad, because Digest を保存した直後、保存を受けたデータセンター以外の読み手には最大 5 分は旧表示のまま (保存時の `delete` は 1 地域にしか効かない)
- Bad, because Cache API の `match` は GET の Request しか受けない。POST 系やトークン付きの要求には使えないが、今はそれらをキャッシュする予定が無い

## Implementation Plan

- **Affected paths**: `frontend/src/shared/api/cache.server.ts` (新規ヘルパー)、`frontend/src/pages/home/api/get-latest-digest.ts`、`frontend/src/pages/home/api/get-link-preview.ts`
- **Dependencies**: なし
- **Patterns to follow**:
  - キャッシュは `*.server.ts` のヘルパー経由で使い、呼び出し側は TTL と load 関数だけ渡す
  - 保存する Response に `Cache-Control: public, max-age=N` を付け、TTL は Cache API に任せる
  - キーは意味のある URL (backend のパス、外部記事の URL) で作る
- **Patterns to avoid**:
  - Go 側にメモリキャッシュを足す (min instances 0 で消える)
  - KV / D1 / Redis を足す
  - SSR の HTML を Cache API に入れる (ログイン状態が混ざる)
  - `fetch` に `cf: { cacheTtl }` を渡す (Cloud Run には効かない)

### Verification

- [x] Vitest: ヘルパーが 2 回目の呼び出しで load 関数を呼ばない。null も関数 TTL でヒットする。load 失敗時は保存しない (`shared/api/cache.server.test.ts`)
- [ ] 本番で `/` を 2 回連続で開き、Cloud Run のリクエストログが 2 回目に出ない
- [x] Vitest: 保存後の削除が最新の Digest・RSS・各日付の RSS 画像のキーを消し、1 つ失敗しても残りを消す (`shared/api/cache.server.test.ts`)
- [ ] 本番で公開中の Digest のタイトルを直して保存し、同じ端末で `/` と `/feed.xml` を開き直すとすぐに反映されている

## Alternatives Considered

- **backend が `Cache-Control` を返し、Workers はそれに従う**: HTTP 的には正しいが、今の構成で `Cache-Control` を見るのは Workers のヘルパーだけ。openapi.yaml にヘッダを足し、生成コードを更新してまで 2 箇所に分ける価値が無い。CDN など第 2 の消費者が出たら backend 側に移す
- **Go プロセス内のメモリキャッシュ**: min instances 0 なので、アクセスの少ないサイトではインスタンスごと消えて効かない
- **Workers KV**: データセンターを跨いで共有できるが有料で、書き込みの反映にも遅れがある。ヒット率の差が意味を持つ規模ではない
- **ゾーンのキャッシュと Purge API で全地域から消す**: 全地域ですぐに反映されるが、Cache API をやめてキャッシュの置き場ごと移すことになる。目的は管理者の手元での確認で、ほかの地域の 5 分の遅れは困らないので見送る (issue #116)

## More Information

- 関連: [adr/backend/0003](../backend/0003-call-backend-from-server-functions-only.md) (Workers だけが backend を呼ぶ前提)、[adr/backend/0006](../backend/0006-host-backend-on-cloud-run-and-cloud-sql.md) (min instances 0 と月額の目安)
- 計測: ヒット率と backend への到達は Workers Logs で見る ([docs/cache-metrics.md](../../docs/cache-metrics.md)、issue #140)
- 再検討条件: 管理者以外の読み手にも全地域で即時反映が要るとき、ヒット率が低くて Cloud Run の請求が目安を超えるとき、backend に Workers 以外の消費者が付いたとき
