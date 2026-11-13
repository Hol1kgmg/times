import { describe, expect, it } from "vitest";
import { withMarkdownNotFound } from "./markdown-not-found.server";

// Start と同じく、Markdown にはルートの有無にかかわらず 406 を返す
const start = () => new Response("{}", { status: 406 });

const markdown = (path: string, method = "GET") =>
  new Request(`https://z-times.dev${path}`, { method, headers: { accept: "text/markdown" } });

describe(withMarkdownNotFound, () => {
  it("answers a missing path requested as Markdown with a Markdown 404 linking to the site guide", async () => {
    const res = await withMarkdownNotFound(start)(markdown("/nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    await expect(res.text()).resolves.toContain("https://z-times.dev/llms.txt");
  });

  it("answers a HEAD for a missing path the same as GET", async () => {
    const res = await withMarkdownNotFound(start)(markdown("/nope", "HEAD"));
    expect(res.status).toBe(404);
  });

  it("treats a path below an existing page as missing", async () => {
    const res = await withMarkdownNotFound(start)(markdown("/about/x"));
    expect(res.status).toBe(404);
  });

  it("keeps the refusal for an existing page requested as Markdown", async () => {
    const res = await withMarkdownNotFound(start)(markdown("/about"));
    expect(res.status).toBe(406);
  });
});
