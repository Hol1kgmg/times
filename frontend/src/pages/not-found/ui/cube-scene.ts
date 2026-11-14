import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  Euler,
  Fog,
  GridHelper,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { narrowQuery } from "#/shared/lib/narrow";
import { reducedMotion } from "#/shared/lib/reduced-motion";
import { fitLayers } from "../lib/fit-layers";
import { loadFallback, loadFavicon, proxiedFavicon } from "../lib/load-favicon";
import { buildStack, dropY, FALL_S, SETTLE_S, startTimes } from "../lib/stack";

// 段の高さと同じ 1 辺。マスとの隙間で回転とずれを取り、隣とめり込まないようにする
const CUBE = 0.75;
// 1 辺 CUBE の正方形が 1 マスに収まる最大の回転
const MAX_YAW = 0.44;
const MAX_DRIFT = 2;
const MAX_KINDS = 24;
// 数を倍にしても積もり終わるまでの時間を延ばさないよう、平均の間隔を半分にする
const INTERVAL_S = 0.06;
const TEXTURE_PX = 64;
const FAVICON_PX = 48;

const quality = (narrow: boolean) =>
  narrow
    ? { grid: 24, width: 7, depth: 9, layers: 6, limit: 140, dpr: 1.5 }
    : { grid: 40, width: 15, depth: 9, layers: 8, limit: 320, dpr: 2 };

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// 透明な部分から裏の面が透けず、面の地の色が見えるよう、地を塗った正方形に描き直す
const paintFace = (canvas: HTMLCanvasElement, img: HTMLImageElement, surface: string) => {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);
  const scale = FAVICON_PX / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (TEXTURE_PX - w) / 2, (TEXTURE_PX - h) / 2, w, h);
};

const run = async (
  renderer: WebGLRenderer,
  area: HTMLElement,
  ceiling: HTMLElement | null,
  urls: readonly string[],
  signal: AbortSignal,
  q: ReturnType<typeof quality>,
  release: () => void,
) => {
  const scene = new Scene();
  const fog = new Fog(token("--color-bg"), 24, 48);
  scene.fog = fog;
  const makeGrid = () =>
    new GridHelper(q.grid, q.grid, token("--color-brand"), token("--color-brand"));
  let grid = makeGrid();
  scene.add(grid);
  scene.add(new AmbientLight(0xff_ff_ff, 1.6));
  const sun = new DirectionalLight(0xff_ff_ff, 2);
  sun.position.set(4, 10, 6);
  scene.add(sun);

  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 14, 26);
  camera.lookAt(0, 5, 0);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = area;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  renderer.render(scene, camera);

  const fallback = await loadFallback();
  const loaded = await Promise.all(
    urls.slice(0, MAX_KINDS).map(async (u) => await loadFavicon(proxiedFavicon(u), fallback)),
  );
  // favicon の無いホストはどれも同じ代替になるので、1 種類にまとめる
  const images = [...new Set(loaded.filter((img) => img !== null))];
  if (signal.aborted) {
    grid.dispose();
    release();
    return;
  }

  // ponytail: 高さは開いたときに 1 回だけ測る。リサイズで山を作り直すなら ResizeObserver で buildStack から
  const layers =
    ceiling === null
      ? q.layers
      : fitLayers(
          camera,
          CUBE,
          q.layers,
          ceiling.getBoundingClientRect().bottom - area.getBoundingClientRect().top,
          area.clientHeight,
        );
  const geometry = new BoxGeometry(CUBE, CUBE, CUBE);
  const blocks = images.length === 0 ? [] : buildStack(q.width, q.depth, layers, q.limit);
  const kinds = images.map((img, k) => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_PX;
    canvas.height = TEXTURE_PX;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshLambertMaterial({ map: texture });
    const count = Math.ceil((blocks.length - k) / images.length);
    const mesh = new InstancedMesh(geometry, material, Math.max(count, 1));
    // 境界球は最初のフレームの原点に縮んだ立方体から作られ、後から積もった分を含まないため
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { img, canvas, texture, material, mesh };
  });

  // トークンの値はダークモードで差し替わるので、そのたびに読み直す
  const paint = () => {
    fog.color.set(token("--color-bg"));
    scene.remove(grid);
    grid.dispose();
    grid = makeGrid();
    scene.add(grid);
    const surface = token("--color-surface");
    for (const kind of kinds) {
      paintFace(kind.canvas, kind.img, surface);
      kind.texture.needsUpdate = true;
    }
  };
  paint();

  const starts = startTimes(blocks, INTERVAL_S);
  const top = layers * CUBE + 8;
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const matrix = new Matrix4();
  const rotation = new Euler();
  const quaternion = new Quaternion();
  const position = new Vector3();
  const one = new Vector3(1, 1, 1);

  const place = (elapsed: number) => {
    for (const [i, b] of blocks.entries()) {
      const kind = kinds[i % kinds.length];
      if (kind === undefined) {
        continue;
      }
      const slot = Math.floor(i / kinds.length);
      const t = elapsed - (starts[i] ?? 0);
      if (t < 0) {
        kind.mesh.setMatrixAt(slot, hidden);
        continue;
      }
      const p = Math.min(1, t / FALL_S);
      const yaw = b.yaw * 2 * MAX_YAW;
      const slack = 0.5 - (CUBE / 2) * (Math.cos(yaw) + Math.abs(Math.sin(yaw)));
      // 横の動きを先に終え、低いところで隣の山を斜めに突き抜けないようにする
      const drift = MAX_DRIFT * (1 - p) * (1 - p);
      rotation.set(
        b.spin[0] * Math.PI * 2 * (1 - p),
        b.spin[1] * Math.PI * 2 * (1 - p) + yaw * p,
        b.spin[2] * Math.PI * 2 * (1 - p),
      );
      position.set(
        b.x - q.width / 2 + 0.5 + b.offset[0] * 2 * slack + b.drift[0] * drift,
        dropY(t, top, b.level * CUBE + CUBE / 2),
        b.z - q.depth / 2 + 0.5 + b.offset[1] * 2 * slack + b.drift[1] * drift,
      );
      matrix.compose(position, quaternion.setFromEuler(rotation), one);
      kind.mesh.setMatrixAt(slot, matrix);
    }
    for (const kind of kinds) {
      kind.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  const total = blocks.length === 0 ? 0 : Math.max(...starts) + SETTLE_S;
  let running = false;
  const observer = new ResizeObserver(() => {
    resize();
    if (!running) {
      renderer.render(scene, camera);
    }
  });
  observer.observe(area);
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const repaint = () => {
    paint();
    if (!running) {
      renderer.render(scene, camera);
    }
  };
  scheme.addEventListener("change", repaint);

  signal.addEventListener("abort", () => {
    running = false;
    observer.disconnect();
    scheme.removeEventListener("change", repaint);
    for (const kind of kinds) {
      kind.texture.dispose();
      kind.material.dispose();
      kind.mesh.dispose();
    }
    geometry.dispose();
    grid.dispose();
    release();
  });

  if (reducedMotion() || total === 0) {
    place(total);
    renderer.render(scene, camera);
    return;
  }

  let elapsed = 0;
  let last: number | undefined;
  running = true;
  const tick = (now: number) => {
    if (!running) {
      return;
    }
    const dt = (now - (last ?? now)) / 1000;
    // タブが隠れて rAF が止まった間の分だけ飛ばす。毎フレーム詰めると遅い端末で落下まで遅くなる
    elapsed += dt > 0.25 ? 0 : dt;
    last = now;
    place(elapsed);
    renderer.render(scene, camera);
    if (elapsed < total) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  };
  requestAnimationFrame(tick);
};

export const startCubePile = async (
  area: HTMLElement,
  ceiling: HTMLElement | null,
  urls: readonly string[],
  signal: AbortSignal,
  onFail: () => void,
  className: string,
) => {
  const q = quality(narrowQuery().matches);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    // WebGL を作れない環境では 2D の山に替える
    onFail();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
  // forceContextLoss した canvas は使い回せないので、回ごとに作って差し込む
  renderer.domElement.className = className;
  area.append(renderer.domElement);
  // GPU のリセットや文脈の上限で後から失われても、背景を空にせず 2D の山に替える
  renderer.domElement.addEventListener("webglcontextlost", () => {
    if (!signal.aborted) {
      onFail();
    }
  });
  const release = () => {
    renderer.dispose();
    // 404 を行き来すると、ブラウザが同時に持てる WebGL の文脈の上限に届くため
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  try {
    await run(renderer, area, ceiling, urls, signal, q, release);
  } catch (error) {
    release();
    if (!signal.aborted) {
      onFail();
    }
    throw error;
  }
};
