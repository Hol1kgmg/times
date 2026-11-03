# Research: Digest の公開を知らせる RSS フィード

## R1. 公開時刻の記録

- **Decision**: `digests.published_at timestamptz NULL` を足し、SQL の中で決める。`CreateDigest` は `status = 'published'` なら `now()`。`UpdateDigest` は `SET published_at = CASE WHEN status = 'draft' AND <新 status> = 'published' THEN now() ELSE published_at END` (UPDATE の右辺の列は更新前の値なので、遷移をそのまま書ける)。既存行は埋めない (FR-008)。`CHECK (status <> 'draft' OR published_at IS NULL)` で「下書きなのに公開時刻がある」を DB で止める。
- **Rationale**: 遷移の判定を 1 文の UPDATE に閉じ込めると、読み直し → 判定 → 書き込みの競合がない。handler は遷移を知らずに済む。
- **Alternatives**: handler で今の status を読んでから決める (1 クエリ増え、トランザクション内でも判定が 2 か所に割れる)。公開の履歴テーブル (公開し直しを通知しないので履歴は要らない)。

## R2. 未来の日付を公開させない (FR-006)

- **Decision**: handler で、書き込みの結果の行 (`RETURNING *`) を見て `status = 'published' && entry_date > 今日 (JST)` なら `apperr.FuturePublish` を返す。トランザクションは既存の `defer tx.Rollback` で巻き戻る。今日は `time.FixedZone("JST", 9*60*60)` で求める。判定は `publishable(d db.Digest, now time.Time) bool` に切り出して go test で境界 (JST 0 時の前後) を押さえる。
- **Rationale**: 書いた後の行で判定すると、登録・ステータス変更・日付変更・status 省略 (今の status を保つ) のどれでも同じ 1 か所で効く。今の status を先に読む必要がない。
- **Alternatives**: DB の CHECK に `current_date` を書く (CHECK は immutable を前提にしており、行が日付をまたぐと既存行が制約違反になる。DB のタイムゾーンにも依存する)。UPDATE の WHERE に条件を足す (0 行が「見つからない」と区別できない)。`time.LoadLocation("Asia/Tokyo")` (distroless に tzdata があるかに依存する。日本は夏時間がないので固定オフセットで足りる)。
- **Problem type**: `/problems/future-publish` (400) を足す。frontend が日付欄のエラーとして出し分けるため、`validation-failed` に混ぜない。

## R3. フィードの形式と配信経路

- **Decision**: RSS 2.0。backend `GET /feed` が `application/rss+xml` を返す (`encoding/xml`、依存なし)。frontend の server route `/feed.xml` が `backendFetchRaw` で取り、Cache API に 300 秒載せて返す (R7)。画像 URL には版 `?v=1` を付ける (デザインを変えたら上げ、外部に残った古い画像を切り替える)。
- **Item**: `title` = `10月20日(火)の times 投稿が公開されました`、`link` = `https://z-times.dev/digest/2026-10-20` (R6)、`guid isPermaLink="false"` = `urn:uuid:<digest id>`、`pubDate` = `published_at` (RFC 1123Z)、`description` = CDATA の `<img>`、`media:content` = 専用画像 (1200×630, image/png)。
- **Channel**: `title` z_times.dev、`link`、`description` (ヒーローの説明文)、`language` ja、`atom:link rel="self"` (W3C Feed Validator が求める)。
- **件数**: 20 件 (`published_at DESC`)。対象は ListPublishedDigests と同じく管理者が作った Digest。
- **サイト URL**: backend に定数 `https://z-times.dev` を置く。frontend の `shared/config/site.ts` と同じく、リクエストの host から組み立てない。環境変数にはしない (変わらない値の設定は持たない)。
- **Alternatives**: backend は JSON を返し frontend が XML を組む (backend で配信するという要件に反する)。Atom (RSS で求められている)。`enclosure` (`length` にバイト数が必須で、画像を作るまで分からない)。

## R4. 日付入りの専用画像

- **Decision**: 下地を事前に作り、日付の文字だけを実行時に描く。
  - **下地**: 既存の `frontend/scripts/og-image.ts` (Playwright で HTML を撮る) に、中央を空けてロゴと説明文を置き直した版を足し、`backend/internal/feed/og-base.png` に書き出す。レイアウトは HTML/CSS で調整でき、デザインの詳細を後で決めても Go を触らない。
  - **文字**: Klee One SemiBold を、日付に出る字 (`0-9月日()` と曜日 7 字) だけのサブセット TTF にして `go:embed` する。`just be-og-font` で pinned の google/fonts から `pyftsubset` で作る (`fe-font-subset` と同じ取得元・同じ道具)。
  - **描画**: `golang.org/x/image/font/opentype` で日付を中央に描き、`image/png` で書き出す。
  - **API**: `GET /feed/images/{entryDate}` (`image/png`)。フィードに載る Digest の日付でなければ 404 (FR-010)。
  - **配信**: frontend の `/feed/images/$file` (`2026-10-20.png`) が zod で `^\d{4}-\d{2}-\d{2}\.png$` を検証して中継する。キャッシュは R7。
- **Rationale**: 実行時に要るのは「文字を 1 行描く」だけにでき、Go の公式拡張パッケージ 1 つで済む。
- **Alternatives**: Workers で `@vercel/og` (`workers-og` / satori + resvg-wasm)。Workers は無料プランで、1 リクエストの CPU 10ms に 1200×630 の描画が収まらない (2026-11-03 にユーザー確認)。有料プランに移ったら、JSX でレイアウトできるこちらへの移行を再検討する。公開時に作って保存 (保存先が新しく要る)。backend でヘッドレスブラウザ (イメージが数百 MB になる)。

## R6. 日ごとのページ (FR-011)

- **Decision**: frontend の route `/digest/$date` (shell の外)。loader が R7 の判定で載っていなければ `notFound()`。`head` で `og:title` (通知の題名)、`og:image` (専用画像)、`robots: noindex`、`canonical` (トップ) を出し、`<meta http-equiv="refresh" content="0; url=/">` で人をトップへ送る。本文は「トップへ」のリンク 1 つだけ。
- **Rationale**: 302 だと SNS のクローラーがトップまで追い、トップの `og:image` を読む。200 + meta refresh ならクローラーはこのページのメタを読み、人はすぐトップへ移る。
- **確認事項 (実装時)**: `__root.tsx` の `og:image` と子の `og:image` が両方出ないか。TanStack Router の `head` は同じ `name` / `property` の meta を子で上書きする前提で、出たら子の route で root の値を外す。
- **Alternatives**: 302 / 301 (上記)。JS の `location.replace` (クローラーには同じだが、JS を切った人が残る)。

## R7. 載っていない日付と取り直しの連打 (FR-012)

- **Decision**:
  - **判定**: frontend は `/feed.xml` の本文 (backend の XML 文字列) を `cachedJson` に 300 秒載せ、画像と日ごとのページは「本文に `/digest/<日付></link>` が含まれるか」で載っているかを決める。載っていなければ backend に行かず 404。XML は自分の backend が作るので、文字列の包含で足りる。
  - **キャッシュのキー**: 日付だけで作る (`https://cache.times.invalid/feed/images/<日付>`)。クエリは見ない。版 `v` は backend の定数で、キーに入れる必要がない (版を上げるのはデプロイと同時で、そのときキャッシュも 300 秒で入れ替わる)。
  - **期間**: フィード・画像・日ごとのページとも 300 秒 (トップと同じ)。404 は載せない (backend に届かないので載せる理由がない)。
  - **レート制限**: 既存の Cloudflare WAF のルール (`/_serverFn/`、IP ごとに 10 秒 30 回) の条件に `/feed` と `/digest/` の前方一致を OR で足す。無料プランはルールが 1 つまでなので、新しいルールは作らない。設定はダッシュボードで行う。
- **Rationale**: backend と DB に届くのは、拠点ごとに 300 秒あたりフィード 1 回と画像最大 20 枚に抑えられる。
- **Alternatives**: 推測できない URL (UUID) にする (でたらめな ID の連打は防げず、フィードが公開なので隠すものもない)。404 を短く載せる (総当たりの日付の数だけ backend に届く)。backend にキャッシュを置く (Cloud Run はインスタンスごとで効かず、Workers の手前で止めるほうが安い)。

## R5. 画面のエラー表示 (FR-007)

- **Decision**: `rejectionOf` に `{ reason: "future-publish" }` を足し、日付欄を `--color-danger` にして「未来の日付は公開できないです。日付を直すか、下書きで保存してください」と出す。`digest-already-exists` と同じ出し方。
- **Alternatives**: 日付が未来なら「公開して保存」を押せなくする (spec の Assumptions で、ピッカーと保存方法は変えないとした)。
