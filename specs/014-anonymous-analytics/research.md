# Research: 匿名 ID で記事別 UU・サイト UU・DAU・MAU を数える

## R1. 匿名 ID の作り方と保存

- **Decision**: localStorage のキー `times.cid` に `crypto.randomUUID()` を保存して、読み手が消すまで使う。読み出した値は `z.uuid()` で検証し、合わなければ作り直して保存し直す。読み書きの例外 (保存を止めたブラウザ、容量超過) は握りつぶし、モジュール変数に持った ID をページの中だけで使い回す。
- **Rationale**: 本文で送るので Cookie は要らない。サーバー側の検証 (R3) も UUID なので、作る側と同じ形式で揃う。localStorage が使えないときにメモリ上の保持へ切り替えるのは、typescript-app.md「無視してよいエラー」の例にそのまま当たる。
- **Alternatives considered**:
  - サーバーが `Set-Cookie` (HttpOnly) で配る: Safari の ITP で消されにくく MAU の水増しが減るが、ユーザーの決定 (localStorage) に反する。R6 の制約として手順書に書き、代わりの方法に残す。
  - GA の `_ga` Cookie の形式 (`GA1.1.xxx.yyy`) に合わせる: gtag.js を使わないので合わせる意味がない。

## R2. `page_view` を送るきっかけ

- **Decision**: `__root.tsx` に小さな部品を置き、`useRouterState` で解決済みの最後の match (`routeId` と `pathname`) を読み、`useEffect` で送る。送るのは routeId が公開画面の許可リスト (`/`、`/_shell/timeline`) に入るときだけ。`/digest/$date` は meta refresh でトップへ移るだけで、入れると 1 回の訪問を 2 件に数えるので入れない。直前に送った `pathname` をモジュール変数に持ち、同じなら送らない。
- **Rationale**:
  - 除外リスト (`/admin` で始まる) だと、ログイン画面 (`$loginPath`) の秘密のパスが GA4 に載ってしまう。新しい画面が増えたときも、許可リストなら黙って送られることがない。
  - 直前の `pathname` を見ることで、React Strict Mode の effect の二重実行、同じ URL への移動、クエリだけの変化を 1 つの仕組みで止められる (spec FR-007)。
  - SSR では effect が走らないので、初回はハイドレーションの後に 1 回だけ送られる。
  - `page_title` は effect の時点の `document.title` を読む。TanStack Start は `<title>` を React のツリーに描くので、effect の前に DOM が更新されている。quickstart で確かめる。
- **Alternatives considered**: `router.subscribe("onResolved")`: 初回の解決を拾うには登録の時点が問題になり、Strict Mode の重複の扱いは結局同じ仕組みが要る。各ページで送る: 呼び忘れが起きる。

## R3. 受付の本文: イベントごとの合併

- **Decision**: `POST /open` の本文を `z.discriminatedUnion("event", [...])` にする。
  - `{ event: "article_click", clientId, articleId, url, entryDate }`
  - `{ event: "page_view", clientId, location, title }`
  `clientId` は `z.uuid()`。本文はまず `request.text()` で読み、4 KB を超えたら 400 にしてから JSON として解析する。`location` は `z.url()` で受けたうえで、受付でクエリとフラグメントを落とし、1,000 文字で切る。`title` は 300 文字で切る。
- **Rationale**:
  - GA4 の上限は `page_location` が 1,000 文字、`page_title` が 300 文字、それ以外のパラメータが 100 文字 (specs/013 R2)。超えた分は GA4 で切られるか捨てられるので、受付で切る。
  - クエリはブラウザでも落として送るが、受付が信頼境界なので受付でも落とす (FR-009)。同じ契約を同じ境界の中で繰り返すのではなく、境界ごとに 1 回ずつにする。
  - 4 KB は、どちらのイベントでも上限の長さまで埋めて 2 KB 程度に収まることから決めた。
  - `event` のない旧形式 (デプロイ前に開いていたタブ) は 400 になる。その分のクリックが少し欠けるのは許容し、手順書の欠測に書く。
- **Alternatives considered**: イベントごとに別のパスにする: 受付が 2 つに増え、bot 除外や端末の分類を共有するための仕組みが要る。

## R4. GA4 のユーザー指標が Measurement Protocol だけで出るか

- **Decision**: `client_id` に匿名 ID を入れ、`page_view` と `article_click` に `engagement_time_msec: 1` を付ける。`session_id` は付けない。UU は探索の「総ユーザー数」で読む。
- **Rationale**:
  - 公式ドキュメント (Measurement Protocol の「Send events」) では、リアルタイムなどにユーザーの活動を出すには `session_id` と `engagement_time_msec` が要るとされる。「アクティブユーザー数」は、GA4 では「エンゲージメントのあったセッション」や `engagement_time_msec` を持つイベントを数えるので、付けなければ 0 になる見込みが高い。
  - 「総ユーザー数」はイベントを 1 件でも記録した異なるユーザーの数なので、`client_id` が揃っていれば出る見込み。ただし明記はないので quickstart の実測で確かめる。
  - `session_id` はセッションの情報で、specs/013 から載せない方針 (spec FR-011)。「アクティブユーザー数」を指標にしないなら要らない。
  - `engagement_time_msec` はセッションの識別子ではなく 1 件ごとの値なので方針に反しない。「アクティブユーザー数」が出るかを実測で比べ、手順書に結果を書く。
- **未確定**: 実測で「総ユーザー数」が期待 (記事別 UU 2、サイト UU 3) と合わなければ、R7 の代わりの方法を手順書に書いて止める。実装は本仕様に含めない。

## R5. GA4 で各指標を出す設定

- **Decision**: すべて探索 (自由形式) で出す。
  - 記事別: 行 `article_id`・`article_url`、値「イベント数」「総ユーザー数」、フィルタ「イベント名 = article_click」
  - サイト UU: 値「総ユーザー数」、フィルタ「イベント名 = page_view」、期間を指定
  - DAU: 上に行「日付」を足す
  - MAU (過去 30 日): 期間を「過去 30 日間」にしたサイト UU。GA4 標準の「28 日間のアクティブ ユーザー数」は 28 日で、アクティブユーザーの定義なので使わない
- **Rationale**: 標準レポートはアクティブユーザーが基準で、イベントのフィルタも自由に付けられない。探索なら指標とフィルタを選べる。
- **前提の設定 (管理者がコンソールで確かめる)**: レポート用識別子を「デバイスベース」にする (User-ID やモデリングが混ざらないように)。Google シグナルは無効のままにする (有効だとユーザー指標にしきい値がかかり、少ない数が隠れる)。データ保持期間は既定の 2 か月だと探索で古い期間が出せないので、14 か月にするかを決める。

## R6. 手順書に書く制約

- **タイムゾーンと日付の境目**: GA4 のプロパティのタイムゾーンで日付を切る。今の設定を確かめて書き写す (Asia/Tokyo を想定)。
- **保持期間**: 探索で出せるのはデータ保持期間 (2 か月か 14 か月) の分だけ。標準レポートの集計値は消えない。
- **bot**: 受付で UA に `bot|crawl|spider|headless` を含むものを除く (specs/013 R6)。GA4 の既知の bot 除外は Measurement Protocol の送信にも効くかが明記されていない。
- **欠測**: JavaScript が動かない環境、ハイドレーション前の操作、`keepalive` の送信失敗、デプロイ前に開いていたタブ (R3)、RSS から直接開いた記事。
- **水増し**: 匿名 ID はブラウザ単位。同じ人の PC とスマホは 2 人、データを消すと別人になる。Safari は、操作のない日が 7 日続くとスクリプトが書いた保存を消す (ITP) ので、たまにしか来ない Safari の読み手は戻るたびに新しい人になり、MAU が多めに出る。
- **足し算**: 1 人が複数の記事を押すので、記事別 UU を足してもサイト UU にならない。サイト UU は `page_view` で数える。

## R7. GA4 で足りないときの代わり

- **BigQuery Export**: GA4 の生イベントを BigQuery に書き出し、`user_pseudo_id` (= 送った `client_id`) を `COUNT(DISTINCT)` で数える。しきい値やモデリングがかからない。BigQuery のプロジェクトとリンクの設定が要り、量が少ないうちは無料枠に収まる見込み。
- **受付で保存する**: Workers から D1 や backend の DB にイベントを残して自前で集計する。いちばん確実だが、保存期間・削除・集計の画面まで自分で持つことになる。
- **Cookie で配る**: R1 の ITP による水増しを減らす。GA4 の指標の問題ではなく、匿名 ID の寿命の問題に効く。
- 選ぶ条件: 実測で「総ユーザー数」が合わなければ BigQuery Export を先に検討する。サイトの画面に指標を出したくなったら受付での保存を検討する。
