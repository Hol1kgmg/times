---
status: 'accepted'
date: 2026-11-13
decision-makers: 'Hol1kgmg'
---

# 404 の 3D の山は three の WebGL とインスタンス描画で描き、着地点を先に決め、favicon は同じオリジンで中継する

## Context and Problem Statement

404 の背景を、オレンジの格子の床に favicon の立方体が落ちて積もる 3D に作り直す (Issue #150、specs/017)。Issue の案は Three.js の `WebGPURenderer` + `BundleGroup` と、物理エンジン (Rapier など) だった。404 は飾りの画面なので、ほかのページを重くせず、描けない環境でも案内を壊さないことが前提になる。

## Decision

1. **three の `WebGLRenderer` で描き、立方体は favicon ごとに 1 つの `InstancedMesh` にまとめる。** 描画命令は favicon の種類 (最大 24) + 床で、立方体の数に比例しない。three と 3D を組み立てるコード (`pages/not-found/ui/cube-scene.ts`) は 404 を開いたときだけ `import()` で読み、three は名前付きの import で必要なものだけを入れる
2. **物理エンジンは使わない。** 着地点 (列・奥・段) を `buildStack` で先に決め、落下と跳ね返りを時間の純粋関数 `dropY` で出す。同じ Digest なら毎回同じ山になり、めり込みや震えが起きない
3. **favicon は `/favicons/$host` で同じオリジンから返す。** Google の s2 とリダイレクト先は `Access-Control-Allow-Origin` を返さず、WebGL は CORS を通っていない画像をテクスチャにできないため。ホスト名は Zod で検証し、Workers の Cache API に 1 日置く
4. **WebGL を作れないときは、今までの 2D の山 (`SandPile`) を出す。**

## Considered Options

- **`WebGPURenderer` + `BundleGroup`**: 2026-11-13 に同じ 160 個・24 種類で測った (specs/017 research R5)。BundleGroup (`static = true`) は通常の Group の CPU 時間を 2.11ms → 0.75ms に減らしたが、WebGL のインスタンス描画は 0.54ms でさらに少なかった。BundleGroup は WebGPU でしか効かず、WebGL に切り替わる環境では別の作りが要る。`WebGPURenderer` は TSL のノードシステムを含み、読み込む量も増える
- **CSS 3D (`preserve-3d` で 6 枚の `<img>`)**: 依存も中継もいらないが、160 個で約 1000 枚の合成レイヤーになり、モバイルのメモリと Safari の重なり順が不安
- **Rapier**: 崩れる・転がるも出せるが、wasm で数百 KB 増え、毎回違う山になる。spec で本物の衝突を求めていない
- **テクスチャアトラス + 1 つの `InstancedMesh`**: 描画命令は 1 回になるが、インスタンスごとの UV のためにシェーダーを書き換える必要がある。24 回の描画命令で負荷は問題にならない
- **2D canvas に描いてからテクスチャにする (中継なし)**: canvas が汚染され、同じく貼れない

## Consequences

- 依存に `three` が増える。404 の chunk は gzip で約 134KB。ほかのページの chunk は増えない (main は中継ルートの登録の +0.4KB だけ)
- `/favicons/$host` は誰でも呼べる。Google の favicon を取るだけで任意の URL は取らないが、乱用されたら最新の Digest のホストに限る
- 開いている間にライト / ダークを切り替えても、床の線と霧の色は変わらない (トークンは初期化の時に 1 回だけ読む)
- three を上げるときは、`BundleGroup` の効き方 (`static` の意味) と `WebGLRenderer` の扱いを見直す。WebGL が非推奨になったら、WebGPU と BundleGroup を測り直す
