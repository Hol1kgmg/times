import { describe, expect, it } from "vitest";
import { withMarkdownNotFound } from "./markdown-not-found.server";

// Start と同じく、Markdown には 406、HTML には known のパスだけ 200 を返す
const start = (known: string) => (request: Request) => {
  if (!(request.headers.get("accept") ?? "").includes("text/html")) {
    return new Response("{}", { status: 406 });
  }
  return new Response("<html>", { status: new URL(request.url).pathname === known ? 200 : 404 });
};

const markdown = (path: string) =>
  new Request(`https://z-times.dev${path}`, { headers: { accept: "text/markdown" } });

describe(withMarkdownNotFound, () => {
  it("answers a missing path requested as Markdown with a Markdown 404 linking to the site guide", async () => {
    const res = await withMarkdownNotFound(start("/about"))(markdown("/nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    await expect(res.text()).resolves.toContain("https://z-times.dev/llms.txt");
  });

  it("keeps the refusal for an existing page requested as Markdown", async () => {
    const res = await withMarkdownNotFound(start("/about"))(markdown("/about"));
    expect(res.status).toBe(406);
  });
});
