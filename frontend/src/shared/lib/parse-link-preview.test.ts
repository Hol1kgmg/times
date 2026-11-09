import { describe, expect, it } from "vitest";
import { parseLinkPreview, parseOEmbed, youTubeId } from "./parse-link-preview";

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

  it("decodes numeric character references in the title", () => {
    const html = `<meta property="og:title" content="stin&#x27;s Blog &#38; &#x110000;">`;
    expect(parseLinkPreview(html, page)?.title).toBe("stin's Blog & &#x110000;");
  });

  it("returns null when nothing usable is present", () => {
    expect(parseLinkPreview(`<meta charset="utf-8"><title> </title>`, page)).toBeNull();
    expect(parseLinkPreview(`<meta name="description" content="  ">`, page)).toBeNull();
  });
});

describe(youTubeId, () => {
  it("reads the video id from watch, youtu.be and shorts URLs", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=P7sK966R3eI&t=1")).toBe("P7sK966R3eI");
    expect(youTubeId("https://youtu.be/P7sK966R3eI?si=x")).toBe("P7sK966R3eI");
    expect(youTubeId("https://m.youtube.com/shorts/P7sK966R3eI")).toBe("P7sK966R3eI");
  });

  it("ignores lookalike hosts and pages without a valid video id", () => {
    expect(youTubeId("https://youtube.com.evil.example/watch?v=P7sK966R3eI")).toBeNull();
    expect(youTubeId("https://www.youtube.com/@channel")).toBeNull();
    expect(youTubeId("https://youtu.be/..%2Fx")).toBeNull();
  });
});

describe(parseOEmbed, () => {
  it("uses the channel name as the description", () => {
    expect(parseOEmbed({ title: "動画", author_name: "チャンネル" })).toStrictEqual({
      title: "動画",
      description: "チャンネル",
    });
  });

  it("yields no text for a response that is not an oEmbed object", () => {
    expect(parseOEmbed("Not Found")).toStrictEqual({ title: null, description: null });
  });
});
