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

- `GET /digests/latest` の結果: TTL 5 分。更新直後に最大 5 分古い表示が出ることを許容し、purge は実装しない
- リンクプレビュー (`getLinkPreview`): 成功は 1 日、失敗 (`null`) も 1 時間キャッシュして、壊れた URL を毎回取りに行かない
- SSR の HTML そのものはキャッシュしない。ヘッダにログイン状態が出るため
- キャッシュキーに共有シークレット (`X-Backend-Token`) を含めない。backend の URL だけで作る
- ローカル (`vite dev`、Node) では `caches` が無いので、無ければ素通しにする

## Consequences

- Good, because Cloud Run / Cloud SQL への到達がほぼアクセス数に比例しなくなる。min instances 0 のままで済む
- Good, because 外部サイトへの fetch が記事 × 閲覧者 から 記事 × 日 に減る。コストの重心はここだった
- Good, because 追加のサービスも課金も無い。コードは Workers のヘルパー 1 つ
- Bad, because Cache API はデータセンター単位で、保持も保証されない。ヒット率は閲覧者の地域に依る。個人サイトの規模では問題にしない
- Bad, because 管理者が Digest を登録した直後、最大 5 分は旧表示のまま。即時反映が要るなら `POST /digests` 成功後に `(await caches.open("times")).delete(...)` を 1 行足す (再検討条件)
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
- [ ] 本番で Digest を登録し、5 分後に `/` に反映される

## Alternatives Considered

- **backend が `Cache-Control` を返し、Workers はそれに従う**: HTTP 的には正しいが、今の構成で `Cache-Control` を見るのは Workers のヘルパーだけ。openapi.yaml にヘッダを足し、生成コードを更新してまで 2 箇所に分ける価値が無い。CDN など第 2 の消費者が出たら backend 側に移す
- **Go プロセス内のメモリキャッシュ**: min instances 0 なので、アクセスの少ないサイトではインスタンスごと消えて効かない
- **Workers KV**: データセンターを跨いで共有できるが有料で、書き込みの反映にも遅れがある。ヒット率の差が意味を持つ規模ではない
- **即時 purge**: 管理者 1 人なので 1 行で済むが、「5 分遅れてよい」と決めたので今は入れない

## More Information

- 関連: [adr/backend/0003](../backend/0003-call-backend-from-server-functions-only.md) (Workers だけが backend を呼ぶ前提)、[adr/backend/0006](../backend/0006-host-backend-on-cloud-run-and-cloud-sql.md) (min instances 0 と月額の目安)
- 再検討条件: 更新の即時反映が要るとき、ヒット率が低くて Cloud Run の請求が目安を超えるとき、backend に Workers 以外の消費者が付いたとき
