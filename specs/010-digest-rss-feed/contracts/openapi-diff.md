# Contract: openapi.yaml の差分

## 追加する操作

```yaml
  /feed:
    get:
      operationId: getFeed
      description: 公開の通知を RSS 2.0 で返す。公開時刻の新しい順に 20 件。frontend の /feed.xml が中継する
      responses:
        "200":
          description: OK
          content:
            application/rss+xml:
              schema:
                type: string
  /feed/images/{entryDate}:
    get:
      operationId: getFeedImage
      description: フィードに載る Digest の日付を入れた画像 (1200×630)。フィードに載らない日付は 404
      parameters:
        - name: entryDate
          in: path
          required: true
          schema:
            type: string
            format: date
      responses:
        "200":
          description: OK
          content:
            image/png:
              schema:
                type: string
                format: binary
        "400":
          $ref: "#/components/responses/BadRequest"
        "404":
          description: Not Found (フィードに載る Digest がその日付にない)
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
```

どちらも `security` なし (X-Backend-Token だけで守る。呼ぶのは frontend の server route)。

## Problem.type に追加

- `/problems/future-publish` (400): 今日 (JST) より後の日付で公開の状態になる保存。`createDigest` と `updateDigest` の 400 に含まれる

## 公開の URL (frontend)

| URL | 中継先 | Content-Type | キャッシュ |
|---|---|---|---|
| `/feed.xml` | `GET /feed` | `application/rss+xml; charset=utf-8` | Cache API 300 秒 |
| `/feed/images/<YYYY-MM-DD>.png` | `GET /feed/images/<YYYY-MM-DD>` | `image/png` | Cache API 300 秒。キーは日付だけ (クエリを見ない) |
| `/digest/<YYYY-MM-DD>` | なし (`/feed.xml` のキャッシュで判定) | `text/html` | ページの描画は通常の route と同じ |

画像と日ごとのページは、キャッシュ済みの `/feed.xml` の本文にその日付の `/digest/<日付></link>` が含まれなければ、backend に行かず 404 を返す (research R7)。

## WAF (Cloudflare ダッシュボード)

既存のレート制限ルール (`/_serverFn/`、IP ごとに 10 秒 30 回) の条件に、`/feed` と `/digest/` の前方一致を OR で足す。
