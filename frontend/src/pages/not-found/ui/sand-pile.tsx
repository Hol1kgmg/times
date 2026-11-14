import { useEffect, useRef } from "react";
import { reducedMotion } from "#/shared/lib/reduced-motion";
import { faviconUrl } from "#/shared/ui/favicon";
import { loadFallback, loadFavicon } from "../lib/load-favicon";
import { buildPile } from "../lib/pile";
import styles from "./sand-pile.module.css";

const GRAIN_PX = 20;
// 粒の高さより詰めて重ね、積み木ではなく砂に見せる
const STEP_PX = GRAIN_PX * 0.8;
const INTERVAL_MS = 50;
// 落とし続けると重くなるので、時間で打ち切る
const DURATION_MS = 24_000;
const FALL_MS = 900;

const startPile = async (
  canvas: HTMLCanvasElement,
  urls: readonly string[],
  signal: AbortSignal,
) => {
  const ctx = canvas.getContext("2d");
  const area = canvas.parentElement;
  if (ctx === null || area === null || urls.length === 0) {
    return;
  }
  // ponytail: 大きさは表示時に 1 回だけ測り、リサイズでは伸ばさず切る。作り直すなら ResizeObserver
  const { clientWidth: width, clientHeight: height } = area;
  const dpr = window.devicePixelRatio;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const cols = Math.max(1, Math.floor(width / GRAIN_PX));
  const rows = Math.floor((height - GRAIN_PX) / STEP_PX) + 1;
  const grains = buildPile(cols, rows, Math.floor(DURATION_MS / INTERVAL_MS)).map((g, i) => {
    const y = height - GRAIN_PX - g.row * STEP_PX;
    return {
      x: (g.col + g.jitter * 0.4) * GRAIN_PX,
      y,
      angle: (g.rotate * Math.PI) / 3,
      start: i * INTERVAL_MS,
      // 落ちる距離の平方根に比例させ、重力で落ちる速さに見せる
      duration: FALL_MS * Math.sqrt((y + GRAIN_PX) / height),
    };
  });
  const total = Math.max(0, ...grains.map((g) => g.start + g.duration));

  const fallback = await loadFallback();
  // canvas 2D は CORS が要らないので、中継が落ちていても Google から直接描ける
  const images = await Promise.all(
    urls.map(async (u) => await loadFavicon(faviconUrl(u), fallback)),
  );

  // ponytail: 毎フレーム全粒を描き直す。粒が千を超えるなら着地済みを別 canvas に焼き付ける
  const draw = (elapsed: number) => {
    ctx.clearRect(0, 0, width, height);
    for (const [i, g] of grains.entries()) {
      const t = elapsed - g.start;
      if (t < 0) {
        break;
      }
      const img = images[i % images.length];
      if (img === null || img === undefined) {
        continue;
      }
      const p = Math.min(1, t / g.duration);
      const y = -GRAIN_PX + (g.y + GRAIN_PX) * p * p;
      ctx.save();
      ctx.translate(g.x + GRAIN_PX / 2, y + GRAIN_PX / 2);
      ctx.rotate(g.angle);
      ctx.drawImage(img, -GRAIN_PX / 2, -GRAIN_PX / 2, GRAIN_PX, GRAIN_PX);
      ctx.restore();
    }
  };

  if (signal.aborted) {
    return;
  }
  if (reducedMotion()) {
    draw(total);
    return;
  }
  const begin = performance.now();
  const tick = (now: number) => {
    if (signal.aborted) {
      return;
    }
    const elapsed = now - begin;
    draw(elapsed);
    if (elapsed < total) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
};

export const SandPile = ({ urls }: { urls: readonly string[] }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (ref.current !== null) {
      void startPile(ref.current, urls, controller.signal);
    }
    return () => {
      controller.abort();
    };
  }, [urls]);

  return <canvas ref={ref} aria-hidden="true" className={styles.pile} />;
};
