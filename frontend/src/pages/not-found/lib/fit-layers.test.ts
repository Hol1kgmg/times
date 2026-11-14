import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitLayers } from "./fit-layers";

const CUBE = 0.75;
const HEIGHT = 800;

const camera = () => {
  const c = new PerspectiveCamera(35, 1, 0.1, 100);
  c.position.set(0, 14, 26);
  c.lookAt(0, 5, 0);
  c.updateMatrixWorld();
  return c;
};

const topPx = (layers: number) =>
  ((1 - new Vector3(0, layers * CUBE, 0).project(camera()).y) / 2) * HEIGHT;

describe(fitLayers, () => {
  it("stacks the mound up to the bottom edge of the text without rising over it", () => {
    const bottom = (topPx(4) + topPx(5)) / 2;
    expect(fitLayers(camera(), CUBE, 8, bottom, HEIGHT)).toBe(4);
  });

  it("keeps the layer limit when the text sits high above the mound", () => {
    expect(fitLayers(camera(), CUBE, 8, 0, HEIGHT)).toBe(8);
  });
});
