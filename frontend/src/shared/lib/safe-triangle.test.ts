import { describe, expect, it } from "vitest";
import { safeTriangle } from "./safe-triangle";

const icon = { left: 0, top: 0, right: 20, bottom: 20 };

describe("safe triangle between the AI icon and its card", () => {
  it("joins the icon to the top edge of a card below it and covers the card's corners", () => {
    expect(safeTriangle(icon, { left: 0, top: 30, right: 200, bottom: 130 })).toBe(
      "polygon(10px 10px, 0px 30px, 0px 130px, 200px 130px, 200px 30px)",
    );
  });

  it("joins the icon to the bottom edge of a card flipped above it", () => {
    expect(safeTriangle(icon, { left: 0, top: -110, right: 200, bottom: -10 })).toBe(
      "polygon(10px 10px, 0px -10px, 0px -110px, 200px -110px, 200px -10px)",
    );
  });
});
