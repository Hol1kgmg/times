import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("固定文字のサブセット", () => {
  it("covers every character written in the UI source (otherwise run just fe-font-subset)", () => {
    const current = execFileSync("node", ["scripts/fixed-chars.ts"], { encoding: "utf-8" });
    const committed = readFileSync("src/app/styles/fonts/fixed-chars.txt", "utf-8");
    expect(committed).toBe(current);
  });
});
