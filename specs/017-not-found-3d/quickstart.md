# Quickstart: 404 の背景を 3D の favicon の立方体にする

## 前提

- `just be-dev` と `pnpm dev` (frontend) が動いていて、最新の公開の Digest がある

## 自動の確認

```sh
just lint && just test     # stack.test.ts を含む
just fe-typecheck
```

e2e は回さない (backend・SQL・セッションに触れない)。

## 手での確認

| # | 操作 | 期待 | spec |
|---|---|---|---|
| 1 | `/no-such-page` を開く | 案内が先に出て、オレンジの格子の床が奥へ霧に溶け、立方体が回転しながら落ちて跳ね、止まって山になる | US1-1、US2 |
| 2 | 落ちている途中にトップへのリンクを押す / Tab で移る | トップに移る / リンクにだけ止まる | US1-2・3 |
| 3 | 開き直す | 同じ形の山になる | US2-6 |
| 4 | `curl -I localhost:3000/favicons/github.com` | `200`、画像の `content-type`、`max-age=86400`。`/favicons/a..b` は `400` | contracts |
| 5 | DevTools の Rendering で `prefers-reduced-motion: reduce` | 積もり終わった山が最初から止まって出る | US3-1 |
| 6 | Chrome を `--disable-webgl` で開く | 2D の山 (今の 404) が出て、エラーは出ない | US3-2 |
| 7 | DevTools のネットワークで `/favicons/*` を止める | 代わりの絵の立方体で山になる | US3-3 |
| 8 | 幅 320px・390px・1920px、窓の大きさを変える | 案内が山に隠れず、横にはみ出さない。キャンバスは新しい大きさに合う | US1-5、US3-7 |
| 9 | 別のタブへ 10 秒移って戻る | 跳ばずに続きから落ちる | US3-6 |
| 10 | 10 分開いたまま、Performance monitor を見る | 止まった後は CPU がほぼ 0、ヒープが増え続けない | SC-003 |
| 11 | 404 → トップ → 404 を 20 回 | コンソールに WebGL の文脈の上限の警告が出ない | FR-015 |
| 12 | `pnpm build` の出力 | `three` は 404 の chunk にだけ入り、ほかの chunk の大きさは main と変わらない | SC-005 |
| 13 | ダークモード | 線はオレンジ、霧は暗い地の色に溶ける | Edge Cases |
| 14 | PC とスマートフォンで Performance を録る | PC 60fps 前後、スマートフォン 30fps 以上 | SC-002 |

## BundleGroup の計測

research R5 の 3 つの組み合わせを使い捨てのページで測り、結果を research R5 に追記する。
