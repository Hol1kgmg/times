# UI Contract: 404 の背景を 3D の favicon の立方体にする

backend の API は変えない。サーバールート 1 つと、ページの中の受け渡しだけを決める。

## `GET /favicons/$host` (app/routes/favicons.$host.ts)

- `host`: ホスト名 (ラベルを `.` でつないだ形、253 文字まで)。形が違えば `400`、本文なし
- 成功: Google の s2 (`sz=64`) が返した画像を、そのままの `content-type` で `200`。`cache-control: public, max-age=86400`
- Google が 200 以外を返したら、その状態をそのまま返す (キャッシュしない)
- 同じオリジンから読むので、CORS のヘッダーは付けない

## `buildStack` / `dropY` (pages/not-found/lib/stack.ts)

```ts
const buildStack: (width: number, depth: number, layers: number, limit: number, seed?: number) => Block[];
const dropY: (t: number, from: number, rest: number) => number; // t は落下の始まりからの秒
```

- `Block` は data-model.md
- `dropY` の値は `rest` 以上、`from` 以下。十分な時間の後は `rest`

## `CubePile` (pages/not-found/ui/cube-pile)

```ts
const CubePile: (props: { urls: readonly string[]; onFail: () => void }) => JSX.Element;
```

- `<canvas aria-hidden="true">`。ポインター操作を受けない (`pointer-events: none`)、`z-index: -1` で案内の下
- `urls` が空なら床だけを描く (spec FR-007)
- WebGL を作れない、または three を読めないときは `onFail` を呼ぶ。`NotFoundPage` はそれを受けて `SandPile` に替える
