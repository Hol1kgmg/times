// 隣が 2 段以上低いあいだ低い側へ転がす。左右が同じ低さなら左に寄せる
export const settle = (heights: readonly number[], start: number): number => {
  let col = start;
  for (;;) {
    const here = heights[col] ?? 0;
    const [lower] = [col - 1, col + 1]
      .filter((n) => n >= 0 && n < heights.length && here - (heights[n] ?? 0) >= 2)
      .toSorted((a, b) => (heights[a] ?? 0) - (heights[b] ?? 0));
    if (lower === undefined) {
      return col;
    }
    col = lower;
  }
};

// 開くたびに山の形を変えないため、種から決まる乱数にする。飾りなので偏りは気にしない
const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s += 1;
    const x = Math.sin(s) * 10_000;
    return x - Math.floor(x);
  };
};

export interface Grain {
  col: number;
  row: number;
  jitter: number;
  rotate: number;
}

// 上限の数か、どれかの列が上端に届いたところで止める
export const buildPile = (cols: number, rows: number, limit: number, seed = 404): Grain[] => {
  const random = seeded(seed);
  const heights = Array.from({ length: cols }, () => 0);
  const grains: Grain[] = [];
  while (grains.length < limit) {
    // 一様に落とすと平らな層になるので、2 つの平均で中央に寄せて山にする
    const col = settle(heights, Math.floor(((random() + random()) / 2) * cols));
    const row = heights[col] ?? 0;
    if (row >= rows) {
      break;
    }
    heights[col] = row + 1;
    grains.push({ col, row, jitter: random() - 0.5, rotate: random() - 0.5 });
  }
  return grains;
};
