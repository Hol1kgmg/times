# Research: 404 の背景を 3D の favicon の立方体にする

## R1. 描き方

- **Decision**: three の `WebGLRenderer` (`alpha: true`、`antialias: true`) で描く。立方体は favicon ごとに 1 つの `InstancedMesh` にまとめ、描画命令を favicon の種類 + 床までに抑える。three は `useEffect` の中の `import("three")` で読み、404 の chunk だけに入れる (ユーザーが決定)
- **Rationale**: WebGL はほぼ全てのブラウザで動き、WebGPU で描けない環境のための切り替えがいらない。インスタンス描画なら立方体の数に比例して描画命令が増えない。`WebGPURenderer` は TSL のノードシステムを含み、バンドルが一番大きい
- **Alternatives considered**: `WebGPURenderer` + `BundleGroup` (Issue の案。R5)。CSS 3D (依存も中継もいらないが、立方体 × 6 面が合成レイヤーになり、160 個で約 1000 枚。モバイルのメモリと Safari の重なり順が不安)。テクスチャアトラス + 1 つの `InstancedMesh` (描画命令は 1 回になるが、インスタンスごとの UV のためにシェーダーを書き換える必要がある。24 回の描画命令なら負荷は問題にならない)

## R2. 物の当たり

- **Decision**: 物理エンジンは使わない。今の `buildPile` を 2 次元の格子 (横 × 奥) に広げた `buildStack` で、着地点 (列・奥・段) を先に決める。落とす位置は 2 つの乱数の平均で中央に寄せ、4 近傍のうち 2 段以上低い方へ転がす。種は固定 (404) で、同じ favicon の並びなら同じ山になる (spec FR-009)。着地したときの向きは Y 軸の回転だけにして、隣とめり込まないよう段の高さを立方体の 1 辺にそろえる
- **Rationale**: 着地点が決まっていれば、貫通・震え・スリープの扱いがいらない (spec FR-008)。Rapier は wasm で数百 KB 増え、毎回違う山になる
- **Alternatives considered**: Rapier (崩れる・転がるも出せるが、spec で求めていない)。自前の AABB の衝突 (回転した箱どうしの当たりで震えが出る)

## R3. 落下と跳ね返り

- **Decision**: 落下は `dropY(t, from, rest)` の純粋関数にする。着地までは ease-in (`t²`)、着地後は振幅が 0.3 倍ずつ減る 2 回の跳ね返り (各 0.15s 前後) を足し、その後は `rest` に固定する。値は `rest` より下に行かない。回転は出現時の乱数の 3 軸から、着地の時点で着地の向き (Y 軸だけ) に補間して止める。時計は `requestAnimationFrame` の差分を足し上げ、1 フレームの差分は 50ms で打ち切る
- **Rationale**: 跳ね返りを式で出せば、止まった後に震えない。経過時間を `now - begin` で出すと、タブから戻ったときに離れていた分だけ進んでしまう (spec FR-013)。差分の打ち切りなら、隠れている間に止まった `requestAnimationFrame` の分を一度に進めない
- **Alternatives considered**: `visibilitychange` で止めて再開する (打ち切りだけで足りる)

## R4. favicon をテクスチャに使う

- **Decision**: `app/routes/favicons.$host.ts` を足す。ホスト名は Zod (ラベルの形の正規表現、253 文字まで) で検証して、それ以外は 400。`https://www.google.com/s2/favicons?domain=<host>&sz=64` を取り、`cachedResponse` で 1 日キャッシュして同じオリジンで返す。クライアントは今の `loadFavicon` と同じく、幅 32px 未満 (Google の既定の 16px) と読み込み失敗を `fallbackFavicon` (同じオリジンの SVG) に替える。`TextureLoader` ではなく、読み込み済みの `HTMLImageElement` を `Texture` に渡す。`colorSpace` は `SRGBColorSpace`
- **Rationale**: Google の s2 とリダイレクト先 (gstatic) はどちらも `Access-Control-Allow-Origin` を返さない (2026-11-13 に curl で確認)。WebGL は CORS を通っていない画像をテクスチャにできない (`SecurityError`)
- **Alternatives considered**: 2D canvas に描いてからテクスチャにする (canvas が汚染され、同じく使えない)。backend で中継する (frontend のサーバーで足りる)。中継するホストを最新の Digest のものに限る (確かめるたびに Digest を読むことになる。Google の favicon を取るだけで、任意の URL は取らない)
- **既知の上限**: 誰でもこのルートで Google の favicon を取れる。1 日キャッシュするので、同じホストは Google へ 1 日 1 回 (Workers のロケーションごと)。乱用されたら最新の Digest のホストに限る

## R5. BundleGroup の採否

- **Decision**: 採らない。実装の後に、同じ 160 個・24 種類で (a) `WebGLRenderer` + `InstancedMesh` (採用)、(b) `WebGPURenderer` + 個別の `Mesh` の通常の `Group`、(c) (b) を `BundleGroup` (`static = false`) にしたもの、の 3 つを、使い捨てのページで比べる。測るのはフレーム時間 (CPU / GPU)、JS のヒープ、初期化の時間で、結果をこの節に追記する
- **Rationale**: `BundleGroup` が減らすのは、描画命令を並べる CPU の負荷。インスタンス描画では描画命令がもともと 25 回前後なので、減らせる分が残らない。WebGPU でしか効かず、WebGL のときは別の作りになる。Issue の完了条件に計測の記録があるので、比較は 1 回だけ行う
- **Alternatives considered**: 計測せずに見送る (Issue の完了条件を満たさない)
- **計測 (2026-11-13)**: Chrome (macOS、WebGPU あり)、DPR 2、1384 × 860。160 個・24 種類の立方体を毎フレーム全部回し、61 フレーム目から 600 フレームを測った。CPU は `render` の前後の時間 (行列の更新を含む)。GPU の時間は測れていない。どれも 60fps (16.67ms) を保った

  | 組み合わせ | CPU / フレーム | 描画命令 | 初期化 | JS ヒープ |
  |---|---|---|---|---|
  | (a) WebGL + InstancedMesh (採用) | 0.54ms | 25 | 136ms | 43MB |
  | (b) WebGPU + 通常の Group | 2.11ms | 161 | 131ms | 24MB |
  | (c) WebGPU + BundleGroup (`static = true`) | 0.75ms | 161 | 111ms | 32MB |
  | (d) WebGPU + BundleGroup (`static = false`) | 1.81ms | 161 | 102ms | 58MB |

  - BundleGroup は通常の Group の CPU を 2.11ms → 0.75ms に減らす (記事の主張どおり)。ただし効くのは構成を固定した `static = true` だけで、`static = false` は毎フレーム記録し直すので通常の Group とほぼ変わらない
  - インスタンス描画 (a) は BundleGroup (c) より CPU が少なく、WebGPU に頼らない。採らない判断は変えない
  - JS ヒープは GC の時機で大きく揺れる (a は 1 回目 29MB、2 回目 43MB) ので、差は判断に使わない。初期化の時間は 2 回目 (モジュールのキャッシュあり) の値
  - 描画命令の 161 は WebGPU 版の 1 フレームの見積もり (立方体 160 + 床)。`renderer.info` は WebGPU で累積の値を返したので使っていない

## R6. カメラ・床・色

- **Decision**: `PerspectiveCamera` (fov 35) を斜め上 (仰角およそ 35°) から、案内の下に山が来るよう床の手前寄りへ向ける。床は `GridHelper` (1 マス = 立方体の 1 辺、PC 40 × 40 / 狭い画面 24 × 24)。線の色は `--color-brand`、奥は `Fog` で `--color-bg` に溶かす。地は透明にして、ページの `--color-bg` をそのまま見せる。光は `HemisphereLight` + `DirectionalLight` の 2 つで、面ごとに明るさを変える。トークンは初期化の時に `getComputedStyle` で 1 回だけ読む。具体的な値は実装で詰めて、UI ルールの 404 の節に書く
- **Rationale**: UI ルールの「有彩色はオレンジだけ」「値はトークン」に合わせる。地を透明にすると、ダークモードでも地の色を合わせ直す必要がない
- **Alternatives considered**: 床を面で塗る (強調面以外にオレンジの地を敷くことになり、UI ルールに反する)
- **既知の上限**: 開いている間にライト / ダークを切り替えても、線と霧の色は変わらない。読み直せば合う

## R7. 数・大きさ・止め方

- **Decision**: 立方体は平均 0.06s (0.3〜1.7 倍に散らす) ごとに 1 個出し、PC 320 個 (床 15 × 9) / 狭い画面 (`--narrow` と同じ幅) 140 個 (床 7 × 9)、または山の段がカメラから見た上限 (案内の下端の高さ) に届いたところで止める。止まったら描画のループも止める (最後のフレームのまま)。DPR は `min(devicePixelRatio, 2)` (狭い画面は 1.5)。窓の大きさが変わったら `ResizeObserver` でキャンバスとカメラの比率だけを合わせ、山は作り直さない
- **Rationale**: 立方体と描画のループが開いている時間に比例して増えない (spec FR-010、SC-003)。止まった後は描き直す理由がない
- **Alternatives considered**: 古い立方体を消して出し続ける (Issue の案。spec で止める方針にした)

## R8. 描けないとき・動きを減らす設定・片付け

- **Decision**: `WebGLRenderer` の生成が例外を投げたら (WebGL なし)、または three の読み込みに失敗したら、`onFail` で `SandPile` (2D) に替える。動きを減らす設定では、全ての立方体を着地点に置いた 1 フレームだけ描く。アンマウントでは `AbortController` でループを止め、ジオメトリ・マテリアル・テクスチャを `dispose` し、`renderer.dispose()` と `forceContextLoss()` で WebGL の文脈を返す
- **Rationale**: ブラウザが同時に持てる WebGL の文脈には上限があり、404 を行き来すると溜まる (spec FR-015)
- **Alternatives considered**: 描けないときは無地にする (ユーザーが 2D の山を選んだ)
