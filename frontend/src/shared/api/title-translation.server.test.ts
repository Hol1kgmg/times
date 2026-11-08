import { describe, expect, it } from "vitest";
import { fromHtml, toHtml } from "./title-translation.server";

const keep = (term: string) => `<span translate="no" class="notranslate">${term}</span>`;

describe("翻訳する HTML", () => {
  it("wraps each term in a no-translate span and escapes the rest", () => {
    expect(toHtml("Use <div> & React", ["React"])).toBe(`Use &lt;div&gt; &amp; ${keep("React")}`);
  });

  it("returns the translation when every term survives with its exact spelling", () => {
    expect(
      fromHtml(`${keep("React")}と${keep("TypeScript")}を使ったアプリ開発`, [
        "React",
        "TypeScript",
      ]),
    ).toBe("ReactとTypeScriptを使ったアプリ開発");
  });

  it("rejects a translation that changed a term's case", () => {
    expect(fromHtml(`${keep("react")}入門`, ["React"])).toBeNull();
  });

  it("restores the double-escaped characters the translator returns", () => {
    expect(fromHtml(`${keep("AT&amp;amp;T")}新しいAPIをリリース`, ["AT&T"])).toBe(
      "AT&T新しいAPIをリリース",
    );
    expect(fromHtml("&amp;lt;div&amp;gt;の使い方", [])).toBe("<div>の使い方");
  });

  it("rejects a translation with an unexpected tag", () => {
    expect(fromHtml("<b>React</b>入門", ["React"])).toBeNull();
  });
});
