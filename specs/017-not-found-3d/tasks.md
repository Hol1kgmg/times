---

description: "Task list for 017-not-found-3d"
---

# Tasks: 404 の背景を 3D の favicon の立方体にする

**Input**: Design documents from `/specs/017-not-found-3d/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: constitution 原則 V と `.agents/rules/quality.md` に従う。山の形と落下の式は Vitest で 1 ロジック 1 テスト。中継の入力は Zod で押さえる。見た目・fps・メモリは backend・SQL・セッションに触れない UI の変更なので e2e は足さず、quickstart.md の手順で手で確かめる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで依存がなく、並行してできる
- **[Story]**: 対応する User Story (US1〜US3)
- パスはリポジトリのルートからの相対

---

## Phase 1: Setup

- [X] T001 ブランチ `feat/not-found-3d` を `main` から切る
- [X] T002 `frontend` で `pnpm add three@0.187` と `pnpm add -D @types/three` を実行し、`frontend/package.json` と `pnpm-lock.yaml` を更新する

---

## Phase 2: Foundational

- [X] T003 [P] `frontend/src/app/routes/favicons.$host.ts` を作る (contracts/ui.md の `GET /favicons/$host`、research R4)。`host` は Zod の `z.string().max(253).regex(...)` (英数字とハイフンのラベルを `.` でつないだ形。空のラベル・先頭と末尾のハイフンは拒む) で検証し、失敗は本文なしの `400`。成功は `cachedResponse("https://cache.times.invalid/favicons/<host>", 86_400, ...)` で `https://www.google.com/s2/favicons?domain=<host>&sz=64` を `fetch` した結果を返す (200 以外はキャッシュせずそのまま)。書き方は `frontend/src/app/routes/feed.images.$file.ts` に揃える
- [X] T004 [P] `frontend/src/pages/not-found/lib/load-favicon.ts` を作り、`frontend/src/pages/not-found/ui/sand-pile.tsx` の `loadImage` / `loadFavicon` を移す。取る URL は `faviconUrl` ではなく `/favicons/${new URL(url).hostname}` にする (2D と 3D で同じ中継とキャッシュを使う)。幅 32px 未満と読み込みの失敗を `fallbackFavicon` に替える判定はそのまま。`sand-pile.tsx` はこれを import する
- [X] T005 [P] `frontend/src/pages/not-found/lib/pile.ts` の `seeded` に `export` を付ける (stack.ts と共有する。テストのためではない)
- [X] T006 `frontend/src/pages/not-found/lib/stack.ts` を作る (data-model.md、research R2・R3)
  - `buildStack(width, depth, layers, limit, seed = 404): Block[]`。`Block` は `{ x, z, level, jitter, yaw, spin: [number, number, number] }`。落とす位置は横・奥それぞれ 2 つの乱数の平均で中央に寄せ、4 近傍のうち 2 段以上低い近傍へ転がす (同じ低さが複数なら、`pile.ts` の `settle` と同じく先に見つかった方)。`level` が `layers` に届いた列が出たら止め、数は `limit` まで。乱数は `seeded`
  - `dropY(t, from, rest)`。落下の時間 `FALL_S` までは `from` から `rest` への ease-in (`t²`)、着地後は振幅が 0.3 倍ずつ減る 2 回の跳ね返り (それぞれ 0.15s 前後)、それ以降は `rest`。値は「`rest` 以上、`from` 以下」
- [X] T007 `frontend/src/pages/not-found/lib/stack.test.ts` を作る。(1) 同じ引数なら同じ並びで、中央の列が端の列より高くなる、(2) どの列も `layers` を超えず、数が `limit` を超えない、(3) `dropY` は全ての t で `rest` 以上 `from` 以下で、十分な時間の後は `rest`、の 3 件。テスト名は仕様の言葉で書く

**Checkpoint**: `just lint && just test` が通る。`curl -I localhost:3000/favicons/github.com` が `200`、`/favicons/a..b` が `400` (quickstart #4)

---

## Phase 3: User Story 1 - 見つからないページでもトップへ戻れる (Priority: P1) 🎯 MVP

**Goal**: 背景が何であっても、案内が SSR で出て、読めて、押せる

**Independent Test**: quickstart.md の #2・#8

- [X] T008 [US1] `frontend/src/pages/not-found/ui/cube-pile.module.css` を作る。`.pile` は `position: absolute; inset: 0; z-index: -1; pointer-events: none;` (今の `sand-pile.module.css` と同じく案内の下に重ねる。3D は窓に合わせて伸ばすので、中央の固定はしない)
- [X] T009 [US1] `frontend/src/pages/not-found/ui/not-found-page.tsx` に、`const [failed, setFailed] = useState(false)` を足す。`failed` なら `<SandPile urls={urls} />`、そうでなければ `<CubePile urls={urls} onFail={() => setFailed(true)} />` を出す。案内の DOM と CSS は変えない (SSR で出たまま。FR-001・FR-002)

**Checkpoint**: `CubePile` が空の `<canvas aria-hidden="true">` を返す段階でも、案内が出て、Tab でリンクにだけ止まり、トップへ移れる

---

## Phase 4: User Story 2 - 奥行きのある床に favicon の立方体が降り積もる (Priority: P1)

**Goal**: オレンジの格子の床に、favicon の立方体が回転しながら落ちて跳ね、山になる

**Independent Test**: quickstart.md の #1・#3・#13・#14

- [X] T010 [US2] `frontend/src/pages/not-found/ui/cube-pile.tsx` を作る (contracts/ui.md の `CubePile`、research R1・R6・R7)。`useEffect` の中で `AbortController` を作り、`startCubePile(canvas, urls, signal, onFail)` を呼ぶ。その中で次を行う
  - `const THREE = await import("three")`。読めなければ `onFail()`
  - `new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })`。例外なら `onFail()`。`setPixelRatio(Math.min(devicePixelRatio, narrow ? 1.5 : 2))`。`narrow` は `matchMedia` で `--narrow` と同じ幅を見る (値は `frontend/src/app/styles` の custom media から写す)
  - 色は `getComputedStyle(document.documentElement)` で `--color-brand` と `--color-bg` を 1 回だけ読む。床は `GridHelper` (1 マス = 立方体の 1 辺。PC 40 × 40、狭い画面 24 × 24、線は `--color-brand`)、`scene.fog = new THREE.Fog(<--color-bg>, near, far)` で奥を地に溶かす
  - カメラは `PerspectiveCamera` (fov 35)、仰角およそ 35° で床の中央の手前寄りを向ける。山が案内の下に来るよう、値は手で詰める
  - 光は `HemisphereLight` + `DirectionalLight`
  - favicon は T004 の `loadFavicon` で読み、種類を最大 24 にする。種類ごとに `Texture` (`colorSpace = SRGBColorSpace`、`needsUpdate = true`) と `MeshLambertMaterial({ map })`、`InstancedMesh(BoxGeometry, material, その種類の数)` を 1 つずつ作る。`BoxGeometry` は共有する
  - `buildStack(width, depth, layers, narrow ? 70 : 160)` で着地点を出し、`i % 種類の数` で各立方体の `InstancedMesh` と添字を決める。出る前の立方体は行列を 0 に縮めて置く
  - ループは `requestAnimationFrame`。経過時間は 1 フレームの差分を `Math.min(dt, 0.05)` で打ち切って足し上げる (FR-013)。立方体 `i` は `i * 0.12` 秒に出て、`dropY` で高さを、回転は `spin` から `yaw` へ着地の時点までに補間する。`setMatrixAt` の後で `instanceMatrix.needsUpdate = true`
  - 全ての立方体が静止したらループを止める (R7)
  - `urls` が空なら床だけを 1 フレーム描いて終える (FR-007)
- [X] T011 [US2] 実際の最新の Digest で `/no-such-page` を開き、カメラの角度・格子の数・立方体の大きさ・`layers` (案内の下端までの段) を詰める。決めた値は `cube-pile.tsx` の定数にし、数字の理由のうちコードから読めないものだけを 1 行コメントに残す

**Checkpoint**: quickstart.md の #1・#3・#13 が手で確かめられる

---

## Phase 5: User Story 3 - どの環境でも 404 として崩れない (Priority: P2)

**Goal**: 動きを減らす設定・WebGL なし・favicon の失敗・狭い画面・長時間の表示で崩れない

**Independent Test**: quickstart.md の #5〜#11

- [X] T012 [US3] `frontend/src/pages/not-found/ui/cube-pile.tsx` で、`reducedMotion()` (`frontend/src/shared/lib/reduced-motion.ts`) が true なら、全ての立方体を着地点 (`rest`・`yaw`) に置いた 1 フレームだけを描いてループを始めない (FR-011)
- [X] T013 [US3] `frontend/src/pages/not-found/ui/cube-pile.tsx` に、キャンバスの親の `ResizeObserver` を足す。`renderer.setSize(w, h, false)` と `camera.aspect` / `updateProjectionMatrix()` だけを行い、山は作り直さない。ループが止まっていれば 1 フレーム描き直す (R7)
- [X] T014 [US3] `frontend/src/pages/not-found/ui/cube-pile.tsx` の片付けを書く (R8、FR-015)。`signal` の abort でループと `ResizeObserver` を止め、ジオメトリ・マテリアル・テクスチャを `dispose()`、`renderer.dispose()` と `renderer.forceContextLoss()` を呼ぶ。three の読み込み中に abort されたら、何も作らずに終える
- [ ] T015 [US3] (済: #5・#6・#8・#11。残り: #7・#9・#10 はユーザーが手で確かめる) quickstart.md の #5〜#11 を手で確かめる。#6 は Chrome の `--disable-webgl` で `SandPile` に替わり、コンソールに利用者向けのエラーが出ないこと

**Checkpoint**: quickstart.md の #5〜#11 が通る

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] `rules/frontend-ui-design.md` の「404 (見つからないページ)」の節を書き換える。背景はオレンジの格子線の床 (`--color-brand`、奥は `--color-bg` の霧に溶かす) に、favicon の立方体を落として積もらせる。床を面で塗らない理由、落下が ease-in である例外、止め方、reduced-motion、WebGL がないときは 2D の山を出すことを、ルールの書き方 (理由を添える) に揃えて書く。T011 で決めた値は書かず、トークンだけを書く。編集後に `rules.nix` の手順で `.agents/rules/` を作り直す
- [X] T017 [P] `adr/frontend/0015-draw-not-found-pile-with-three-webgl.md` を `adr-skill` の形で書く。決定は「three の WebGL + favicon ごとの InstancedMesh、着地点を先に決める、favicon は同じオリジンで中継」。見送った案は WebGPU + BundleGroup、CSS 3D、Rapier、アトラス + 1 つの InstancedMesh (research R1・R2・R4・R5)。`adr/README.md` の索引に足す
- [X] T018 research R5 の 3 つ (WebGL + InstancedMesh / WebGPURenderer + 通常の Group / WebGPURenderer + `BundleGroup` の `static = false`) を、同じ 160 個・24 種類で比べる使い捨てのページを scratchpad に作り、PC で、フレーム時間 (CPU / GPU)、JS のヒープ、初期化の時間を測る。結果の表を `specs/017-not-found-3d/research.md` の R5 に追記する。ページはリポジトリに入れない
- [X] T019 `pnpm build` (frontend) の出力で、`three` が 404 の chunk にだけ入り、ほかの chunk の大きさが `main` と変わらないことを確かめる (quickstart #12、SC-005)
- [X] T020 `just lint && just test && just fe-typecheck` を通す。e2e は回さない (`.agents/rules/quality.md` の完了の判定。backend・SQL・セッションに触れない)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → Polish
- T006 は T005 の後、T007 は T006 の後。T003・T004・T005 は並行できる
- US1 (T008・T009) は `CubePile` の殻だけを要るので、T010 の前に入れて先に案内の振る舞いを確かめる
- US2 の T010 は T004・T006 に依存する。T011 は T010 の後
- US3 の T012〜T014 はすべて `cube-pile.tsx` を触るので順に行う
- T016・T017 は T011 の後なら並行できる。T018 は US2 の後ならいつでもよい

## Parallel Example

```text
# Phase 2
T003 favicons.$host.ts   |  T004 load-favicon.ts   |  T005 pile.ts の export

# Polish
T016 rules/frontend-ui-design.md   |  T017 adr/frontend/0015
```

## Implementation Strategy

- **MVP**: Phase 1〜4 (US1 + US2)。WebGL のある PC とスマートフォンで新しい 404 が出る。この時点でも、WebGL がない環境は T009 の `onFail` で 2D の山に替わる
- **次**: US3 で reduced-motion・リサイズ・片付けを入れ、quickstart を全部通す
- **最後**: UI ルール・ADR・BundleGroup の計測を残し、Issue #150 の完了条件を満たす
