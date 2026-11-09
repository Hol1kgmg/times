# Data Model: 記事リンクのクリック数を記事ごとに数える

DB・OpenAPI・保存の形は変えない。新しく現れるのは、ブラウザ → 受付の本文と、受付 → GA4 のイベントの 2 つだけ。

## 記事を開いた記録 (ブラウザ → 受付)

| 項目 | 型 | 検証 | 出どころ |
|---|---|---|---|
| `articleId` | uuid | `articleId` (schemas.ts のブランド型) | `Article.id` / `ChildArticle.id` |
| `url` | string | `z.url()` | 記事の URL |
| `entryDate` | string | `z.iso.date()` | `Digest.entryDate` |

- 子記事も同じ形。親子の区別は載せない (子記事は別の記事として数える)。
- 形が合わなければ 400 で捨てる (spec FR-006)。

## article_click (受付 → GA4 Measurement Protocol)

| 項目 | 値 |
|---|---|
| `client_id` | `crypto.randomUUID()` (毎回使い捨て、spec FR-011) |
| `ip_override` | `CF-Connecting-IP` ヘッダー。なければ付けない |
| `device.category` | UA から `mobile` / `tablet` / `desktop` |
| `events[0].name` | `article_click` |
| `events[0].params.article_id` | `articleId` |
| `events[0].params.article_url` | `url` の先頭 100 文字 (GA4 の値の上限) |
| `events[0].params.digest_date` | `entryDate` |

- UA が bot に当たれば作らない (spec FR-007)。
- `session_id` / `engagement_time_msec` / `user_id` は付けない。

## 環境変数 (Workers)

| 名前 | 種類 | 用途 |
|---|---|---|
| `GA_MEASUREMENT_ID` | Variable | `measurement_id` |
| `GA_API_SECRET` | Secret | `api_secret` |

どちらかが空なら GA4 に送らず 204 を返す (ローカル開発・preview)。クライアントバンドルには出さない (spec FR-008)。
