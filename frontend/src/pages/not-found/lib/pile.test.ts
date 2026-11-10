import { describe, expect, it } from "vitest";
import { buildPile, settle } from "./pile";

describe(settle, () => {
  it("rolls down the slope until the step to each neighbor is less than 2", () => {
    expect(settle([0, 2, 4], 2)).toBe(0);
  });

  it("stays inside the edges even when the edge column is the tallest", () => {
    expect(settle([4, 3], 0)).toBe(0);
  });
});

describe(buildPile, () => {
  it("stops dropping once a column reaches the top", () => {
    expect(buildPile(1, 3, 100)).toHaveLength(3);
  });
});
