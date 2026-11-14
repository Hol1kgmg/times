import { seeded } from "./pile";

export interface Block {
  x: number;
  z: number;
  level: number;
  offset: [number, number];
  yaw: number;
  spin: [number, number, number];
  drift: [number, number];
  gap: number;
}

// 4 近傍のうち 2 段以上低いところがある間、いちばん低い方へ転がす
const settle = (heights: number[][], start: [number, number]): [number, number] => {
  let [x, z] = start;
  for (;;) {
    const here = heights[x]?.[z] ?? 0;
    const [lower] = (
      [
        [x - 1, z],
        [x + 1, z],
        [x, z - 1],
        [x, z + 1],
      ] as const
    )
      .filter(([nx, nz]) => here - (heights[nx]?.[nz] ?? Infinity) >= 2)
      .toSorted(([ax, az], [bx, bz]) => (heights[ax]?.[az] ?? 0) - (heights[bx]?.[bz] ?? 0));
    if (lower === undefined) {
      return [x, z];
    }
    [x, z] = lower;
  }
};

// 上限の数か、どこかが layers 段に届いたところで止める
export const buildStack = (
  width: number,
  depth: number,
  layers: number,
  limit: number,
  seed = 404,
): Block[] => {
  const random = seeded(seed);
  // 一様に落とすと平らな層になるので、2 つの平均で中央に寄せて山にする
  const center = (n: number) => Math.floor(((random() + random()) / 2) * n);
  const heights = Array.from({ length: width }, () => Array.from({ length: depth }, () => 0));
  const blocks: Block[] = [];
  while (blocks.length < limit) {
    const [x, z] = settle(heights, [center(width), center(depth)]);
    const column = heights[x];
    const level = column?.[z] ?? 0;
    if (column === undefined || level >= layers) {
      break;
    }
    column[z] = level + 1;
    blocks.push({
      x,
      z,
      level,
      offset: [random() - 0.5, random() - 0.5],
      yaw: random() - 0.5,
      spin: [random() - 0.5, random() - 0.5, random() - 0.5],
      drift: [random() - 0.5, random() - 0.5],
      gap: random(),
    });
  }
  return blocks;
};

export const FALL_S = 0.9;
const BOUNCE_S = 0.15;
const BOUNCES = [0.3, 0.09];
export const SETTLE_S = FALL_S + BOUNCE_S * BOUNCES.length;

// 等間隔だと着地の拍子がそろって見えるので、間隔を 0.3〜1.7 倍に散らす
export const startTimes = (blocks: readonly Block[], interval: number): number[] => {
  const settled = new Map<string, number>();
  let at = 0;
  return blocks.map((b, i) => {
    at += i === 0 ? 0 : interval * (0.3 + 1.4 * b.gap);
    const cell = `${b.x},${b.z}`;
    // 真下が跳ねている間に落ちると、跳ね上がった下の立方体にめり込むため
    const start = Math.max(at, settled.get(cell) ?? 0);
    settled.set(cell, start + SETTLE_S);
    return start;
  });
};

// 跳ね返りを式で出し、止まった後に震えず、着地点より下にめり込まないようにする
export const dropY = (t: number, from: number, rest: number): number => {
  if (t <= 0) {
    return from;
  }
  if (t < FALL_S) {
    const p = t / FALL_S;
    return from - (from - rest) * p * p;
  }
  const i = Math.floor((t - FALL_S) / BOUNCE_S);
  const amplitude = BOUNCES[i];
  if (amplitude === undefined) {
    return rest;
  }
  const u = (t - FALL_S - i * BOUNCE_S) / BOUNCE_S;
  return rest + Math.min(amplitude, from - rest) * Math.sin(Math.PI * u);
};
