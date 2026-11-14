import { describe, expect, it } from "vitest";
import { buildStack, dropY, SETTLE_S, startTimes } from "./stack";

const heightAt = (blocks: ReturnType<typeof buildStack>, x: number, z: number) =>
  blocks.filter((b) => b.x === x && b.z === z).length;

describe(buildStack, () => {
  it("builds the same mound every time, taller in the middle than at the edge", () => {
    const blocks = buildStack(9, 9, 6, 120);
    expect(buildStack(9, 9, 6, 120)).toStrictEqual(blocks);
    expect(heightAt(blocks, 4, 4)).toBeGreaterThan(heightAt(blocks, 0, 0));
  });

  it("stops at the block limit and never stacks a column past the layer limit", () => {
    expect(buildStack(9, 9, 100, 30)).toHaveLength(30);
    const blocks = buildStack(3, 3, 2, 1000);
    expect(Math.max(...blocks.map((b) => b.level))).toBeLessThan(2);
  });
});

describe(startTimes, () => {
  it("drops a block only after the one below it in the same cell has settled", () => {
    const blocks = buildStack(9, 9, 6, 120);
    const starts = startTimes(blocks, 0.06);
    const early = blocks.filter((b, i) => {
      const below = blocks.findIndex((o) => o.x === b.x && o.z === b.z && o.level === b.level - 1);
      return below !== -1 && (starts[i] ?? 0) < (starts[below] ?? 0) + SETTLE_S;
    });
    expect(early).toStrictEqual([]);
  });
});

describe(dropY, () => {
  it("never sinks below the landing height and comes to rest there", () => {
    const ys = Array.from({ length: 200 }, (_, i) => dropY(i / 100, 10, 2));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
    expect(dropY(SETTLE_S + 0.01, 10, 2)).toBe(2);
  });
});
