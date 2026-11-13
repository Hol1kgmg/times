# Implementation Plan: 404 の背景を 3D の favicon の立方体にする

**Branch**: `feat/not-found-3d` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-not-found-3d/spec.md`

## Summary

404 の背景を three の `WebGLRenderer` で描く 3D の山に置き換える。床は `GridHelper` のオレンジの格子線と、地の色に溶かす `Fog`。立方体は favicon ごとに 1 つの `InstancedMesh` (`BoxGeometry` + `MeshLambertMaterial`) で描く。物理エンジンは使わない。今の `buildPile` を 2 次元の格子に広げた `buildStack` で着地点を先に決め、落下と跳ね返りは時間の純粋関数 `dropY` で出す (research R2・R3)。WebGL のテクスチャは CORS を通った画像しか使えないので、Google の favicon を同じオリジンで返すサーバールート `/favicons/$host` を足す (R4)。three は 404 を開いたときだけ `import("three")` で読む。WebGL を作れないときは今の `SandPile` (2D) を出す。動きを減らす設定では、積もり終わった山を 1 フレームだけ描く。backend・DB・OpenAPI は変えない。

## Technical Context

**Language/Version**: TypeScript (strict)、React 19

**Primary Dependencies**: `three` (新規、0.187.x、404 の chunk だけに入る)。型は `@types/three`。ほかは既存 (TanStack Start のサーバールート、`cachedResponse`、`getLatestDigest`、`fallbackFavicon`)

**Storage**: Workers の Cache API (favicon を 1 日)。DB は使わない

**Testing**: Vitest (`pages/not-found/lib/stack.test.ts`: 山の形・再現性・上限、`dropY` の跳ね返りが着地点より下に行かず止まること)。e2e は足さない (backend・SQL・セッションに触れない)。見た目・fps・メモリは quickstart で手で確かめる

**Target Platform**: PC・モバイルのブラウザ (Cloudflare Workers で配信)。WebGL 1 以上

**Project Type**: web (frontend だけを変える)

**Performance Goals**: PC 60fps、モバイル 30fps 以上 (SC-002)。描画命令は favicon の種類 (最大 24) + 床の 1 つまで

**Constraints**: 404 以外の chunk の大きさを変えない (SC-005)。案内は SSR のまま (SC-006)。立方体は使い回さず上限で止める。DPR の上限は 2 (狭い画面は 1.5)。色はトークンを `getComputedStyle` で読み、生の値を書かない

**Scale/Scope**: 立方体は PC 160 個、狭い画面 70 個まで。favicon は 1 日 20 サイト前後

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec → plan → tasks の順。実装は承認後 |
| II. 契約ファースト | ✅ | backend・OpenAPI・SQL を変えない。favicon の中継は frontend のサーバールートで、backend を通らない。受け渡しは `contracts/ui.md` |
| III. サーバー関数経由 | ✅ | backend を呼ぶ経路は増えない。中継は Google へのリクエストだけで、入力 (ホスト名) は Zod で検証する |
| IV. 最小実装 | ⚠️ 依存を足す | `three` を足す。理由と却下した案は Complexity Tracking。物理エンジン・WebGPU・BundleGroup・オブジェクトの使い回しは足さない (R1・R2・R5) |
| V. テストとスキーマ | ✅ | 山の形と落下の分岐は Vitest。中継の入力は Zod。見た目は quickstart |

Phase 1 の設計の後も、上の 1 件のほかに違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/017-not-found-3d/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
└── tasks.md             # /speckit-tasks で作る
```

### Source Code (repository root)

```text
rules/frontend-ui-design.md                  # 404 の節を 3D の山に書き換える (.agents/rules は Nix の生成物)
adr/frontend/0015-draw-not-found-pile-with-three-webgl.md  # 新規: three (WebGL + Instanced) を選び、WebGPU / BundleGroup / CSS 3D / 物理エンジンを見送った理由
frontend/package.json                        # three、@types/three
frontend/src/
├── app/routes/favicons.$host.ts             # 新規: Google の favicon を同じオリジンで返す (Zod でホスト名を検証、Cache API 1 日)
└── pages/not-found/
    ├── lib/stack.ts                         # 新規: buildStack (2 次元の格子の山)、dropY (落下と跳ね返り)
    ├── lib/stack.test.ts                    # 新規: Vitest
    ├── lib/pile.ts                          # seeded を stack.ts と共有する (export を足す)
    ├── ui/cube-pile.tsx / .module.css       # 新規: 3D の山の殻。cube-scene を import() し、失敗したら onFail で SandPile に替える
    ├── ui/cube-scene.ts                     # 新規: three の名前付き import でシーンを組み立てる (404 の chunk にだけ入る)
    ├── ui/sand-pile.tsx                     # 3D を描けないときの代わりとして残す。favicon の読み込みを共有する
    └── ui/not-found-page.tsx                # SandPile → CubePile (失敗時に SandPile)
```

**Structure Decision**: 404 のページの slice (`pages/not-found`) の中で閉じる。ほかのページで使わないので `shared` に上げない。中継のルートだけは TanStack Router の規約で `app/routes` に置く。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `three` を依存に足す | 奥行きの床・陰影・重なり順の正しい立方体を数百個、モバイルでも滑らかに描くため (spec FR-004・FR-008、SC-002) | WebGL を直に書く (行列・シェーダー・テクスチャの管理を自前で持つことになり、three より大きなコードになる)。CSS 3D (立方体 × 6 面で 1000 近い合成レイヤーになり、モバイルのメモリと Safari の重なり順が不安。ユーザーが three を選んだ) |
| favicon の中継ルートを足す | WebGL のテクスチャは CORS を通った画像しか使えず、Google の favicon は `Access-Control-Allow-Origin` を返さない (R4) | 2D canvas に描いてから貼る (canvas が汚染され、同じく貼れない)。backend に中継を置く (frontend のサーバーだけで足り、backend を巻き込む理由がない) |
