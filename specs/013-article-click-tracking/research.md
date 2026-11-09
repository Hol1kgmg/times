# Research: 記事リンクのクリック数を記事ごとに数える

## R1. 端末・地域を Measurement Protocol でどこまで載せられるか (issue #109「決めること」)

- **Decision**: 地域は `ip_override` に `CF-Connecting-IP` を入れて GA4 に導かせる。端末は `device.category` だけを User-Agent から `mobile` / `tablet` / `desktop` に分けて載せる。`user_agent` は送らない。
- **Rationale**: 公式リファレンス (developers.google.com/analytics/devguides/collection/protocol/ga4/reference) では、`ip_override` は「GA が地域を導く IP」、`device` は `category` / `language` / `screen_resolution` / `operating_system` / `browser` などを持つ構造で「最低限 `category` を推奨」とされる。トップレベルの `user_agent` はドキュメントにない。`device` を送らないと「タグのイベント (`app_instance_id`) から導く」とあり、Measurement Protocol だけで送る今回は何も導かれない。地域は IP 1 行で国・地方まで出るので、`user_location` を自前で組まない。
- **Alternatives considered**:
  - `user_location` を `request.cf.country` / `regionCode` から組む: TanStack Start のサーバールートで `request.cf` が取れるかの確認が要る。`ip_override` で足りる。
  - UA を解析して OS・ブラウザまで載せる: 解析の依存を足すか正規表現を育てることになる。今回の目的 (記事ごとの回数、PC とモバイルの内訳) は `category` で足りる。
  - 何も載せない: PC・モバイルの内訳が見えなくなる。
- **未確定**: `device` が web ストリームで効くことはドキュメントに明記されていない。quickstart の DebugView / 探索で `デバイス カテゴリ` が出るかを確かめ、出なければ `device` を外す。

## R2. Measurement Protocol の送り方と上限

- **Decision**: `POST https://www.google-analytics.com/mp/collect?measurement_id=…&api_secret=…`、本文は `client_id` + `ip_override` + `device` + `events[1]`。`article_url` は先頭 100 文字に切る。
- **Rationale**: パラメータ値は 100 文字まで (GA360 以外)。記事の URL は 100 文字を超えうる。記事の識別は `article_id` が担うので、URL は何の記事か読めれば足りる。応答は本文が不正でも 2xx を返すので、送る前に自分で形を確かめる (R4) 以外に検証の手段はない。失敗しても再送しない (spec FR-003)。
- **Alternatives considered**: 長い URL を捨てる (イベントごと送らない): 記事の回数が欠ける。EU エンドポイント (`region1`): 要件にない。

## R3. client_id・セッション

- **Decision**: `client_id` はイベントごとに `crypto.randomUUID()`。`session_id` / `engagement_time_msec` は付けない (issue で決定済み)。
- **Rationale**: ドキュメントでは、これらがないイベントも「一部のレポートに出るが、エンゲージメントやリアルタイムのユーザー数には正しく反映されない」とされる。回数は探索 (自由形式) で数えるので影響しない。

## R4. 受付の作り: サーバールート

- **Decision**: TanStack Start のサーバールート `POST /open` (`frontend/src/app/routes/open.ts`)。本文を Zod で検証し、bot を除き、`cloudflare:workers` の `waitUntil` で GA4 への送信を応答の後に回して 204 を返す。形が合わなければ 400。
- **Rationale**:
  - サーバー関数 (`createServerFn`) は呼び出しの `fetch` に `keepalive` を付けられない。サーバールートなら `fetch(url, { method: "POST", keepalive: true })` をそのまま書ける。既存の `feed[.]xml.ts` と同じ形。
  - パス名は issue のとおり計測らしい語 (`track` / `collect` / `analytics` / `beacon` / `event` / `log`) を避け、読み手の動作「記事を開いた」を表す `open` にする。
  - `waitUntil` は `workers-ai.server.ts` と同じく動的 import にする。vite dev (Node) には `cloudflare:workers` がないため。dev では測定 ID も未設定なので送らずに 204 を返す。
- **Alternatives considered**: `sendBeacon` (Chrome で `ping` 種別になりブロッカーのルールに当たりうる)、`<a ping>` (Firefox が既定で無効)、リダイレクト (コピーで中継 URL が取れる)、gtag.js (ドメインで止められる)。いずれも issue で却下済み。

## R5. 中クリックとタップの拾い方

- **Decision**: React Aria の `Link` の `onPress` (左クリック・タップ・Enter) と `onAuxClick` (`button === 1` のときだけ) で送る。
- **Rationale**: RAC の `LinkProps` は `GlobalDOMAttributes<HTMLAnchorElement>` から `onClick` だけを除いており、`onAuxClick` は渡せる。`onPress` は主ボタンでだけ発火するので、中クリックと二重に数えない。右クリック (`button === 2`) は `auxclick` でも来るので `button` で除く。

## R6. bot の除外

- **Decision**: 受付で User-Agent を `/bot|crawl|spider|headless/i` で見て、当たれば送らずに 204。`ponytail:` で上限を残す。
- **Rationale**: issue で「UA を見るだけ」と決定済み。JS を実行してクリックまでする bot はまれで、主な対象はヘッドレスブラウザ。依存 (`isbot` など) は足さない。e2e の Playwright (`HeadlessChrome`) もここで落ち、GA4 に届かない。

## R7. 型の上でプレビューから送れなくする

- **Decision**: `DigestPost` の props を 2 つの形の合併にする。`{ digest: Digest; onOpen?: … }` と `{ digest: DigestContent; onOpen?: never }`。`onOpen` は `(article: { id: ArticleId; url: string }) => void`。
- **Rationale**: 下書き (`DigestContent`) の記事には `id` がなく、`onOpen` を渡すと型エラーになる。プレビュー (`preview-dialog.tsx`) は今のまま何も渡さない。`onOpen` は送信の関数を受けるだけにし、`DigestPost` (shared/ui) から通信を呼ばない。
