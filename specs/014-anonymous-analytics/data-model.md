# Data Model: 匿名 ID で記事別 UU・サイト UU・DAU・MAU を数える

DB は変えない。値はブラウザの localStorage と GA4 にだけ置く。

## 匿名 ID (ブラウザ)

| 項目 | 値 |
|---|---|
| 置き場所 | localStorage `times.cid`。読み書きできなければモジュール変数 (ページの中だけ) |
| 形式 | UUID (`crypto.randomUUID()`)。読み出しで `z.uuid()` に合わなければ作り直す |
| 寿命 | 読み手が消すまで。期限なし |
| 使い道 | GA4 の `client_id` |

## 受付の本文 (`POST /open`)

`event` で分ける合併。詳細は [contracts/open.md](./contracts/open.md)。

| event | 項目 | 検証 |
|---|---|---|
| 共通 | `clientId` | `z.uuid()` |
| `article_click` | `articleId` / `url` / `entryDate` | specs/013 と同じ (`articleId`、`z.url()`、`z.iso.date()`) |
| `page_view` | `location` | `z.url()`。受付でクエリ・フラグメントを落とし、1,000 文字で切る |
| `page_view` | `title` | `z.string()`。300 文字で切る |

本文全体は 4 KB まで。

## GA4 に送るイベント

| event | params | 共通 |
|---|---|---|
| `article_click` | `article_id` / `article_url` (100 文字) / `digest_date` / `engagement_time_msec: 1` | `client_id` = 匿名 ID、`ip_override`、`device.category` |
| `page_view` | `page_location` (1,000 文字) / `page_title` (300 文字) / `engagement_time_msec: 1` | 同上 |

## 指標

| 指標 | 定義 | GA4 での出し方 |
|---|---|---|
| 記事クリック数 | `article_click` の件数 | 探索: 行 `article_id`、値「イベント数」 |
| 記事別 UU | 期間内にその記事を押した異なる匿名 ID の数 | 同じ探索に値「総ユーザー数」 |
| サイト UU | 期間内に `page_view` を持つ異なる匿名 ID の数 | 探索: フィルタ `page_view`、値「総ユーザー数」 |
| DAU | 日ごとのサイト UU | 上に行「日付」 |
| MAU | 過去 30 日のサイト UU (暦の月ではない) | 期間「過去 30 日間」のサイト UU |

## 公開画面 (page_view を送る routeId)

`/`、`/_shell/timeline`。これ以外 (`/digest/$date` (トップへ移るだけ)、`/_shell/admin.*`、`/_shell/$loginPath.auth.login`、`/auth/github/callback`、`/_shell/health`) は送らない。
