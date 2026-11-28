import { describe, expect, it } from "vitest";
import { candidates, pickTerms } from "./title-candidates";
import type { Candidate } from "./title-candidates";

const yesFor = (cands: Candidate[], yes: Record<string, number>) =>
  cands.map((c) => yes[c.text] ?? 0);

describe("固有名称の候補", () => {
  it("splits a title into one- to three-word candidates without surrounding punctuation", () => {
    const texts = candidates("Next.js: Building with TanStack Start").map((c) => c.text);
    expect(texts).toContain("Next.js");
    expect(texts).toContain("TanStack Start");
    expect(texts.some((t) => t.includes(":"))).toBeFalsy();
  });

  it("keeps the longer term when candidates overlap", () => {
    const cands = candidates("Building with TanStack Start");
    expect(pickTerms(cands, yesFor(cands, { TanStack: 0.9, "TanStack Start": 0.9 }))).toStrictEqual(
      ["TanStack Start"],
    );
  });

  it("drops candidates below 0.5", () => {
    const cands = candidates("React npm");
    expect(pickTerms(cands, yesFor(cands, { React: 0.49, npm: 0.5 }))).toStrictEqual(["npm"]);
  });
});
