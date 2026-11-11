type Rect = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

// 近い辺の両端から始めて外接矩形を一周させ、角丸で欠けた角も塞ぐ
const cornersFromNearestEdge = (x: number, y: number, to: Rect): [number, number][] => {
  const tl: [number, number] = [to.left, to.top];
  const tr: [number, number] = [to.right, to.top];
  const bl: [number, number] = [to.left, to.bottom];
  const br: [number, number] = [to.right, to.bottom];
  if (y < to.top) {
    return [tl, bl, br, tr];
  }
  if (y > to.bottom) {
    return [bl, tl, tr, br];
  }
  return x < to.left ? [tl, tr, br, bl] : [tr, tl, bl, br];
};

export const safeTriangle = (from: Rect, to: Rect): string => {
  const x = (from.left + from.right) / 2;
  const y = (from.top + from.bottom) / 2;
  const points = [[x, y], ...cornersFromNearestEdge(x, y, to)];
  return `polygon(${points.map(([px, py]) => `${px}px ${py}px`).join(", ")})`;
};
