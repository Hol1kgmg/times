import { describe, expect, it } from "vitest";
import { parseLinkPreview } from "./parse-link-preview";

const page = "https://x.example/posts/1";

describe(parseLinkPreview, () => {
  it("prefers og:description and resolves a relative og:image", () => {
    const html = `<html><head>
      <meta name="description" content="plain">
      <meta content="og &amp; &quot;quoted&quot;" property="og:description">
      <meta property='og:image' content='/img/a.png'>
    </head></html>`;
    expect(parseLinkPreview(html, page)).toStrictEqual({
      title: null,
      description: 'og & "quoted"',
      image: "https://x.example/img/a.png",
    });
  });

  it("falls back to description and drops non-http images", () => {
    const html = `<meta name="Description" content="plain"><meta property="og:image" content="data:image/png;base64,AAAA">`;
    expect(parseLinkPreview(html, page)).toStrictEqual({
      title: null,
      description: "plain",
      image: null,
    });
  });

  it("prefers og:title and falls back to the title element", () => {
    const withOg = `<title>doc</title><meta property="og:title" content="og">`;
    expect(parseLinkPreview(withOg, page)?.title).toBe("og");
    expect(parseLinkPreview(`<title> a &amp; b </title>`, page)?.title).toBe("a & b");
  });

  it("returns null when nothing usable is present", () => {
    expect(parseLinkPreview(`<meta charset="utf-8"><title> </title>`, page)).toBeNull();
    expect(parseLinkPreview(`<meta name="description" content="  ">`, page)).toBeNull();
  });
});
