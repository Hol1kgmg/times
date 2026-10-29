# 調査メモ: Chrome でトップを開くとタブの読み込み表示が止まらない

- 調査日: 2026-10-26 〜 2026-10-27
- 状態: **原因判明・修正済み (未デプロイ)**。`favicon.tsx` の `onLoad` が代替 SVG への差し替えを無限に繰り返していた (「原因」を参照)。以下の「解消の経緯と今後の確認」以降は、原因が分かる前の記録として残す

## 原因

`frontend/src/shared/ui/favicon.tsx` の `onLoad` は、`naturalWidth < 32` の画像を代替 SVG (`fallback-favicon.svg`) に差し替えていた。この代替 SVG も `width="16"` なので、差し替えた後の `onLoad` でも同じ条件が成り立ち、同じ SVG に差し替え続けていた。Chrome は同じ URL を `src` に入れ直しても読み込み直して `load` を出すため、画像の読み込みが終わらず、window の `load` が来なかった。

- 止まった回に代替 SVG の `<img>` の `load` を数えると、開いてから 4 秒で約 30〜43 万回、その 2 秒後には約 55〜67 万回と増え続けていた。
- ループに入るのは、favicon の応答がハイドレーションの後に届き、React の `onLoad` が呼ばれたときだけ。先に届くとハンドラーがまだ付いておらず、差し替えが起きない。止まる回と止まらない回が出たのはこのため。
- 未完了の `<img>` が 0 件に見えたのは、キャッシュから読むたびに `complete` が `true` になるため。
- `onError` で代替 SVG に差し替えた場合も、その後の `onLoad` から同じループに入る。
- Safari で起きないのは、同じ `src` を入れ直しても読み込み直さないためとみている (未確認)。
- 本番で 2026-10-28 から止まらなくなったのは、その日の記事に、差し替えが起きるドメイン (favicon がないドメインや 404 のドメイン) がなかったためとみている。Bot Fight Mode は関係しない見込み。
- TanStack Start と React は原因ではない。ハイドレーションの前後で `onLoad` が呼ばれるかどうかを決めているだけ。

修正: 代替 SVG になっている画像は差し替えないようにした (`getAttribute("src") !== fallbackFavicon`)。`local-ab.mjs` の遅い 16px の条件 (`slow16swap`) は、12/12 回止まっていたのが 0/12 回になった。

残っていること:

- 本番にデプロイして、Chrome でトップを開き、タブの読み込み表示が止まるかを見る。
- Bot Fight Mode をオンに戻す (止めていたのは切り分けのため)。

`79f71eb` で外した `loading="lazy"` は、原因ではなかったので戻し、理由のコメントも消した。戻した状態でも `local-ab.mjs` は全条件で 0/12 回だった。e2e の `admin.ts` に入れていた回避策 (`domcontentloaded` で待つ) も消した。
- 対象: `https://z-times.dev/` (トップ)

## 解消の経緯と今後の確認

- 新しい Digest を登録してトップに出るリンクの組み合わせが変わると、ぐるぐるが出なくなった。
- 直前に Bot Fight Mode をオフにしていたので、止まらなくなった理由として次の 2 つが考えられ、まだどちらとも決められない。
  1. **Bot Fight Mode をオフにした設定が反映された**: 設定変更がすぐには効かず、Digest の更新と時期が重なっただけという可能性。ただし、Cloudflare の差し込みがない workers.dev でも再現していたので、可能性は低いとみている。
  2. **リンク (favicon を取るドメイン) の側に原因があった**: 特定のドメインの favicon の応答 (リダイレクトの経路や応答時間) が引き金になっていた可能性。ローカルに同じ 21 件を入れても再現しなかったので、データだけでは説明できない。
- 今後の運用で次を見て切り分ける。
  - Bot Fight Mode をオフのまま、Digest を更新するたびに Chrome でトップを開き、タブのぐるぐるが止まるかを見る。オフのままで再発したら 1 は外れる。
  - 再発したら、その日の記事のドメインを控え、このメモの手順 (favicon の遮断・モック) で止まるかを確かめる。
  - しばらく再発しなければ、Bot Fight Mode をオンに戻して再発するかを見る。オンに戻して再発したら 1 が有力になる。
- 当時のリンク群 (止まっていたときにトップに出ていた 21 件) は、開発 DB の 2026-10-27 分に残っている。`just db-seed` で戻すと消えるので、戻す前に控える。

## ローカルでの再現 (e2e 環境)

2026-10-28 に `just fe-test-e2e` が落ちたことから、ローカルでも再現できると分かった。

### e2e テストで再現する

```sh
just db-up
just be-dev-e2e                                  # 別のターミナルで起動したままにする
just fe-test-e2e e2e/admin-login.spec.ts --reporter=line
```

- ログイン後に `/` へ戻るのを待つ `page.waitForURL(atHome)` (`frontend/e2e/admin-login.spec.ts`) がタイムアウトする。`waitForURL` は既定で load イベントまで待つため。
- 2026-10-28 の実行では US2 の 3 件が落ちた。同じ待ち方の US1 は通ったので、落ちる件数は毎回変わる。
- 失敗時のスナップショット (`frontend/test-results/*/error-context.md`) を見ると、`/` は描画済みで、ログインも済んでいる。

### スクリプトで再現する (条件を変えて止まる率を比べる)

`just be-dev-e2e` に加えて `just fe-dev` (`localhost:3000`) を起動しておく。そのうえで、下の「再現に使ったスクリプト」の `local-ab.mjs` を `frontend` で `node --input-type=module < local-ab.mjs` として実行する。`frontend` の node_modules から `@playwright/test` を読むため、`frontend` をカレントにして標準入力から渡す。

- 何もしなければ止まる率は低い (6 回中 2 回、12 回中 1 回)。
- favicon を「遅れて返る 16px の画像」にすると、毎回止まる。調べるときはこの条件を使う。
- 別々のコンテキストで並列に開くと、遅らせても止まらなかった (各 12 回中 0 回)。1 つのコンテキストで順に開いたときだけ再現する。並列にしたことの何が効いているのかは分かっていない。

### 結果 (Playwright の Chromium、`localhost:3000`、1 つのコンテキストで 12 回ずつ順に開き、4 秒後の `readyState` を見る)

| 条件 | 止まった回数 |
|---|---|
| そのまま | 1/12 |
| favicon (`www.google.com/s2/favicons`、`*.gstatic.com`) を遮断 | 0/12 |
| アプリの JS を遮断 | 0/12 |
| favicon に 1px の PNG を即座に返す (差し替えあり) | 0/12 |
| favicon に 1px の PNG を 200〜1700ms 遅らせて返す (差し替えあり) | 11/12 |
| favicon に 16px の PNG を 200〜1700ms 遅らせて返す (差し替えあり) | **12/12** |
| favicon に 32px の PNG を 200〜1700ms 遅らせて返す (差し替えなし) | 0/12 |
| 遅れて返る 16px の PNG + アプリの JS を遮断 (ハイドレーションされず、差し替えのハンドラーが付かない) | 0/12 |

止まるのは次の 3 つがそろったときだけだった。

1. favicon の応答が遅い。
2. 応答が届くのがハイドレーションの後で、React の `onLoad` が呼ばれる。
3. `onLoad` の中で `src` を代替 SVG に差し替える (Google が返す 16px の既定画像は `naturalWidth < 32` になるため)。

止まった回でも、`complete` でない `<img>` は 0 件だった。差し替えた後の画像は読み込み済みなのに、load が来ない。

### 原因になりそうなコード

`frontend/src/shared/ui/favicon.tsx` の `onLoad` で `e.currentTarget.src = fallbackFavicon` と差し替えている箇所。`onError` でも同じように差し替えているので、同じことが起きる可能性がある (未検証)。

- 上の「favicon の応答をモックした場合」で差し替えても止まらなかったのは、即座に返したので、ハイドレーションより先に読み込みが終わっていたためとみている。その場合 React の `onLoad` は呼ばれず、差し替えも起きない。
- 本番で 2026-10-28 から止まらなくなったのは、その日の記事に、Google が 16px の既定画像を返すドメイン (favicon がないドメイン) がなかったからかもしれない。未確認。
- (2026-10-28) 差し替えるとなぜ load が来なくなるのかは、その後に分かった。代替 SVG への差し替えが無限に続いていた (「原因」を参照)。

## 症状

- Chrome 系のブラウザでトップを開くと、画面は表示されて操作もできるのに、タブのぐるぐる (読み込み中の表示) が止まらない。
- 原因は load イベントが来ないこと。`document.readyState` が `interactive` のまま止まり、`performance.getEntriesByType('navigation')[0].loadEventEnd` も 0 のまま。
- 毎回ではない。止まる率は Chrome の実機で 4〜6 割、Playwright の Chromium で 2〜8 割 (計測の回によって幅がある)。
- Safari では起きない。
- ゲストプロファイル、すべての拡張機能を無効にした状態でも起きる。シークレットモードで起きなかったのは、止まらない回に当たっただけとみている。

## 止まった回の状態

- HTML のレスポンスは約 0.5 秒で閉じている (`curl` の `time_total`)。
- CSS・JS・フォント・画像はすべて読み込み済み。`document.fonts.status` は `loaded`、`<img>` も `complete`。
- Playwright で CDP の `Network.*` イベントを数えると、**未完了のリクエストは 0 件**。違うのは、load の後に送られる `cdn-cgi/rum` が出ないことだけ (load が来なかった結果)。
- Claude in Chrome のネットワークログでは、Google favicon のリダイレクト先 (`t0`〜`t3.gstatic.com/faviconV2?...`) が `pending` と表示されることがある。ただし、その `<img>` 自体は `complete` で、CDP の結果とも食い違うので、この表示は信用していない。
- iframe なし、Service Worker の登録なし。

## 切り分けの結果

### 配信元による違い (いちばん強い手がかり)

| 配信元 | 中身 | 結果 |
|---|---|---|
| `https://z-times.dev/` (Workers + ゾーン設定) | 本番 | 止まる |
| `https://times.abdevs-horisho.workers.dev/` (Workers のみ、Cloudflare の差し込みなし) | 本番 | 止まる (Chrome で 4 回中 2 回) |
| `http://127.0.0.1:8766/` (本番を中継するローカルのプロキシ。HTML・JS・アセットはすべて本番のもの) | 本番 | 止まらない (5 回中 0 回) |
| `http://localhost:3000/` (`just fe-dev`) | 本番と同じ 21 件を今日の日付で投入 | 止まらない (4 回中 0 回) |
| `http://localhost:4173/` (`just fe-preview`、本番ビルド) | 同上 | 止まらない (4 回中 0 回) |

同じデータ、同じビルド、同じ HTML と JS でも、手元の HTTP から配信すると止まらない。止まるのは Workers から HTTPS (HTTP/2・3) で配信したときだけ。

(2026-10-28 追記) その後、手元の HTTP でも止まることが分かった。回数が少ないと止まらない回にばかり当たることがあり、favicon の応答を遅らせると毎回止まる。この表の「HTTPS でだけ止まる」という読みは誤り。「ローカルでの再現 (e2e 環境)」を参照。

### リソースを遮断した場合 (Playwright、workers.dev / z-times.dev、各 6 回)

| 遮断したもの | 止まった回数 |
|---|---|
| なし | 6/6 |
| アプリの JS (`z-times.dev/assets/*.js`) | 0/6 |
| favicon (`www.google.com`、`*.gstatic.com`) | 0/6 |
| フォント (`*.woff2`) | 6/6 |

アプリの JS と外部 favicon の**両方がそろったときだけ**止まる。

### favicon の応答をモックした場合 (Playwright、workers.dev、各 6 回)

| 応答 | 止まった回数 |
|---|---|
| 32px の PNG を即座に返す (差し替えなし) | 0/6 |
| 16px の PNG を即座に返す (`onLoad` で代替 SVG に差し替え) | 0/6 |
| 301 で別ホストへリダイレクトし、32px の PNG を返す | 0/6 |

即座に返すと止まらない。本物の Google の応答時間 (リダイレクト込みで数十〜数百 ms) が関係している可能性がある。遅延を入れたモックは未実施。

### HTML の書き換え (Playwright、z-times.dev。`loading="lazy"` 削除のデプロイ前)

| 変更 | 止まった回数 |
|---|---|
| そのまま | 3/12、6/25 |
| `loading="lazy"` を外す | 0/12、0/25 |
| `CollapsiblePanel` の `overflow: clip` → `hidden` | 0/12 |
| `CollapsiblePanel` の `overflow: clip` → `visible` | 5/12 |

この結果を受けて `loading="lazy"` を外し、`79f71eb` としてデプロイした。しかし、デプロイ後の本番でも止まった (Chrome の実機で 3 回中 2 回、Playwright で 12 回中 8 回)。lazy は原因ではなかった。この表の差は、計測のばらつきか条件の違いとみている。

## 原因ではないと確かめたもの

| 候補 | 根拠 |
|---|---|
| 拡張機能 | すべて無効、ゲストプロファイルでも再現 |
| キャッシュ・Cookie・ログイン状態 | ゲストプロファイルと Playwright の新規コンテキストで再現。未ログインでも再現 |
| Cloudflare の JS Detections (`cdn-cgi/challenge-platform/scripts/jsd/main.js`) | 差し込みのない workers.dev でも再現 |
| Cloudflare Web Analytics のビーコン (`beacon.min.js`) | 同上 |
| データ (記事の組み合わせ) | 本番と同じ 21 件をローカルに入れても再現しない |
| 本番ビルドそのもの | `fe-preview` では再現しない |
| `loading="lazy"` | 外してデプロイしても再現 |
| ~~favicon の `onLoad` / `onError` での `src` の差し替え~~ | **2026-10-28 に撤回**。favicon の応答が遅いと、差し替えたときだけ止まった (「ローカルでの再現 (e2e 環境)」)。当時の根拠は「404 のドメインを 32px で返して差し替えを止めても再現 (12 回中 10 回)」だったが、これは 404 のドメインの分だけを止めたもので、ほかのドメインの差し替えは残っていた可能性がある |
| `overflow: clip` 単体 | 最小のページでは load まで届く |
| フォント | 遮断しても再現 |
| Service Worker | z-times.dev に登録なし |
| HTML のストリーミング配信 | Playwright で HTML を丸ごと受け取ってから返しても再現 |

## 残っている仮説

1. **HTTPS (安全なコンテキスト) とリモート配信でだけ変わる Chrome の挙動**
   - 手元の HTTP では止まらず、Workers の HTTPS でだけ止まる。
   - 確かめ方: 手元の本番ビルドを HTTPS で配信して (自己署名証明書か `vite preview --https`) 再現するか見る。
   - (2026-10-28) 手元の HTTP でも再現したので、この仮説は外れとみている。
2. **外部 favicon の応答時間と hydration のタイミングの競合**
   - 2026-10-28 にローカルで確かめた。応答の遅い favicon をハイドレーションの後に差し替えると、毎回止まる (「ローカルでの再現 (e2e 環境)」)。
   - (2026-10-28) これが原因だった。差し替えた後の `onLoad` が、同じ代替 SVG への差し替えを無限に繰り返していた (「原因」を参照)。
3. **load を遅らせているのがネットワーク以外のもの**
   - 画像のデコード、`load` イベントの発火待ち、React の hydration 中の DOM 操作など。
   - 確かめ方: Chrome のトレース (`chrome://tracing` か DevTools の Performance パネル) で、load を待たせている要素を見る。

## 回避策の候補 (原因が分からなくても止まらなくなりそうなもの)

- **favicon を同じオリジンから返す**: Workers で Google から取得してキャッシュし、`/favicon/<host>` などで返す。遮断の試験では、外部 favicon がなければ止まらなかった。
- **favicon を hydration の後に読み込む**: SSR の HTML には `src` を出さず、クライアントでマウントしてから付ける。アプリの JS と favicon が競合しているなら避けられる。

どちらもまだ試していない。

## 調査中に変えたもの

- `79f71eb fix(frontend): favicon の遅延読み込みをやめ、Chrome で load が来ないのを直す`: `frontend/src/shared/ui/favicon.tsx` から `loading="lazy"` を外した。効果はなかったので、戻すかどうか判断が必要。`wrangler deploy` で本番に反映済み (Version ID `4cb35523-1efc-4d7d-9686-d1dbdde02d6e`)。
- Cloudflare の Bot Fight Mode をオフにした。解消の理由がこれか切り分けるまでオフのままにする (「解消の経緯と今後の確認」を参照)。
- 開発 DB の 2026-10-27 と 2026-10-26 を、本番と同じ 21 件で上書きした。元に戻すなら `just db-seed` を実行する。

## 再現に使ったスクリプト

Playwright は `frontend` の `@playwright/test` を使う。スクリプトはセッションの一時領域に置いたので残らない。要点を残す。

```js
// 新しいコンテキストで開き、5 秒後に readyState を見て「止まった回」を数える
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.route((u) => block(u), (r) => r.abort()); // 遮断の試験
await page.goto("https://times.abdevs-horisho.workers.dev/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const stuck = (await page.evaluate(() => document.readyState)) !== "complete";
```

- 未完了のリクエストの洗い出し: `ctx.newCDPSession(page)` で `Network.enable` し、`requestWillBeSent` と `loadingFinished` / `loadingFailed` を突き合わせた。
- HTML の書き換え: `page.route("https://z-times.dev/", ...)` で `route.fetch()` した本文を書き換えて `route.fulfill()` した。
- favicon のモック: `www.google.com/s2/favicons` への要求を `route.fulfill()` で 32px / 16px の PNG や 301 に差し替えた。

### `local-ab.mjs` (ローカルでの再現。2026-10-28)

`localhost:3000` を 1 つのコンテキストで 12 回ずつ順に開き、条件ごとに止まった回数を出す。条件は `cases` を書き換えて足す。

```js
import { chromium } from "@playwright/test";
import zlib from "node:zlib";

// w×w の真っ黒な PNG。16 は差し替えが起き (naturalWidth < 32)、32 は起きない
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let x = 0xffffffff;
  for (const b of buf) x = crcTable[(x ^ b) & 255] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const pngOf = (w) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(w, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * w);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const fav = /google\.com\/s2\/favicons|gstatic\.com/;
const isAppJs = (u) =>
  u.port === "3000" && /\.(tsx?|jsx?|mjs)(\?|$)|\/@|node_modules/.test(u.pathname + u.search);
const slow = (body) => async (route) => {
  await new Promise((s) => setTimeout(s, 200 + Math.random() * 1500));
  await route.fulfill({ body, contentType: "image/png" }).catch(() => {});
};

const cases = {
  base: async () => {},
  blockFav: (p) => p.route(fav, (r) => r.abort()),
  blockJs: (p) => p.route(isAppJs, (r) => r.abort()),
  slow16swap: (p) => p.route(fav, slow(pngOf(16))),
  slow32noswap: (p) => p.route(fav, slow(pngOf(32))),
  slow16noJs: async (p) => {
    await p.route(fav, slow(pngOf(16)));
    await p.route(isAppJs, (r) => r.abort());
  },
};

const N = 12;
const browser = await chromium.launch();
for (const [name, setup] of Object.entries(cases)) {
  // 並列の別コンテキストでは再現しなかったので、1 つのコンテキストで順に開く
  const ctx = await browser.newContext();
  let stuck = 0;
  for (let i = 0; i < N; i++) {
    const page = await ctx.newPage();
    await setup(page);
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    if ((await page.evaluate(() => document.readyState)) !== "complete") stuck++;
    await page.close();
  }
  await ctx.close();
  console.log(name, `${stuck}/${N}`);
}
await browser.close();
```
