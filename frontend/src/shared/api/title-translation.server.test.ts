import { describe, expect, it } from "vitest";
import { fromHtml, toHtml } from "./title-translation.server";

const keep = (term: string) => `<span translate="no" class="notranslate">${term}</span>`;

describe("翻訳する HTML", () => {
  it("wraps each term in a no-translate span and escapes the rest", () => {
    expect(toHtml("Use <div> & React", ["React"])).toBe(`Use &lt;div&gt; &amp; ${keep("React")}`);
  });

  it("returns the translation when every term survives with its exact spelling", () => {
    expect(
      fromHtml(
        "Building Apps with React and TypeScript",
        ["React", "TypeScript"],
        `${keep("React")}と${keep("TypeScript")}を使ったアプリ開発`,
      ),
    ).toBe("ReactとTypeScriptを使ったアプリ開発");
  });

  it("rejects a translation that changed a term's case", () => {
    expect(fromHtml("Learn React", ["React"], `${keep("react")}入門`)).toBeNull();
  });

  it("restores the double-escaped characters the translator returns", () => {
    expect(
      fromHtml("AT&T releases a new API", ["AT&T"], `${keep("AT&amp;amp;T")}新しいAPIをリリース`),
    ).toBe("AT&T新しいAPIをリリース");
    expect(fromHtml("How to use <div>", [], "&amp;lt;div&amp;gt;の使い方")).toBe("<div>の使い方");
  });

  it("rejects a translation with an unexpected tag", () => {
    expect(fromHtml("Learn React", ["React"], "<b>React</b>入門")).toBeNull();
  });

  it("drops the spaces the translator adds between a kept term and Japanese text", () => {
    expect(
      fromHtml(
        "Local AI BGM. Stable Audio 3 on Apple Silicon (MLX).",
        ["AI", "BGM", "Stable Audio 3", "Apple Silicon", "MLX"],
        `ローカル${keep("AI")} ${keep("BGM")}。${keep("Apple Silicon")} （ ${keep("MLX")} ）上で${keep("Stable Audio 3")} 。`,
      ),
    ).toBe("ローカルAI BGM。Apple Silicon（MLX）上でStable Audio 3。");
  });

  it("rejects a translation that repeats a word more often than the original", () => {
    expect(
      fromHtml(
        "Stable Audio 3 on Apple Silicon (MLX)",
        ["Stable Audio 3", "Apple Silicon", "MLX"],
        `Apple ${keep("Apple Silicon")} （ ${keep("MLX")} ）上で${keep("Stable Audio 3")} 。`,
      ),
    ).toBeNull();
  });
});
