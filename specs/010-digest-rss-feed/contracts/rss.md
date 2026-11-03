# Contract: /feed.xml の形

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>z_times.dev</title>
    <link>https://z-times.dev/</link>
    <description>見かけて気になった技術や趣味の記事を、日ごとにゆるくまとめてます。</description>
    <language>ja</language>
    <atom:link href="https://z-times.dev/feed.xml" rel="self" type="application/rss+xml"/>
    <item>
      <title>10月20日(火)の times 投稿が公開されました</title>
      <link>https://z-times.dev/digest/2026-10-20</link>
      <guid isPermaLink="false">urn:uuid:0b6f…</guid>
      <pubDate>Tue, 03 Nov 2026 21:04:05 +0900</pubDate>
      <description><![CDATA[<img src="https://z-times.dev/feed/images/2026-10-20.png?v=1" alt="10月20日(火)" width="1200" height="630">]]></description>
      <media:content url="https://z-times.dev/feed/images/2026-10-20.png?v=1" type="image/png" medium="image" width="1200" height="630"/>
    </item>
  </channel>
</rss>
```

- item は 0〜20 件。0 件でも 200 で channel だけを返す
- guid は Digest ごとに固定。日付を変えても同じ
- link は日ごとのページ。200 で `og:*` を返し、人は meta refresh でトップへ送る
- 画像 URL の `v` は backend の定数。デザインを変えたら上げる
- pubDate は JST で書く (読者が日本語圏のため。RFC 822 のオフセット付きなのでリーダーはどの地域でも正しく読む)
