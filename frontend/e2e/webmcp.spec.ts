import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { ChannelPath } from "#/shared/config/channels";
import { z } from "zod";
import { boardOf, fillDate, loggedInState } from "./admin";

// WebMCP は実験段階で、Chromium ではフラグを付けたときだけ動く (adr/frontend/0014)
test.use({ launchOptions: { args: ["--enable-features=WebMCP"] } });

// ツールはハイドレーションの後に登録される
const hasTool = async (page: Page, name: string) => {
  const tools = await page.webmcp.tools();
  return tools.some((t) => t.name === name);
};

const toolText = z.object({ content: z.tuple([z.object({ text: z.string() })]) });

test("トップの WebMCP の navigate を呼ぶと、指定した画面に移る", async ({ browser }) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  await page.goto("/");
  await expect.poll(async () => await hasTool(page, "navigate")).toBe(true);
  await page.webmcp.callTool("navigate", {
    to: "/admin/digests/new",
  } satisfies { to: ChannelPath });
  await page.waitForURL((url) => url.pathname === "/admin/digests/new");
  await context.close();
});

test("未ログインでトップを開くと、WebMCP には最新の Digest を読むツールだけが渡り、それを呼ぶと日付が返る", async ({
  page,
}) => {
  await page.goto("/");
  await expect.poll(async () => await hasTool(page, "get_latest_digest")).toBe(true);
  const tools = await page.webmcp.tools();
  expect(tools.map((t) => t.name)).toEqual(["get_latest_digest"]);
  const result = toolText.parse(await page.webmcp.callTool("get_latest_digest", {}));
  expect(result.content[0].text).toMatch(/^\d{4}-\d{2}-\d{2}\n|^まだ記事がありません$/u);
});

test("登録画面の WebMCP の add_articles で URL を入れ、update_articles でタイトル・カテゴリ・ホットを直すと、人は保存を押すだけで登録できる", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  // 同じ DB を使い回すので、実行ごとに URL と日付を変えて重複 (400) を避ける
  const run = Date.now();
  const date = new Date(run - 400 * 86_400_000).toISOString().slice(0, 10);
  await page.goto("/admin/digests/new");
  await expect.poll(async () => await hasTool(page, "add_articles")).toBe(true);
  await fillDate(page, date);
  const added = toolText.parse(
    await page.webmcp.callTool("add_articles", {
      urls: [`https://e2e.example/${run}/a`, `https://e2e.example/${run}/b`],
    }),
  );
  const ids = [...added.content[0].text.matchAll(/^- (?<id>[\da-f-]{36}):/gmu)].map(
    (m) => m.groups?.id,
  );
  expect(ids).toHaveLength(2);
  const [a, b] = ids;
  await page.webmcp.callTool("update_articles", {
    articles: [
      { id: a, title: `AI の記事 ${run}`, category: "AI系", hot: true },
      { id: b, title: `その他の記事 ${run}`, category: "その他" },
    ],
  });
  const { unsorted, boxOf } = boardOf(page);
  await expect(unsorted.getByText("ここにドラッグ")).toBeVisible();
  const ai = boxOf("AI系").getByRole("listitem");
  await expect(ai.getByText("AI が振り分けました")).toBeVisible();
  await expect(ai.getByRole("img", { name: "ホット" })).toBeVisible();
  await page.getByRole("button", { name: "下書きで登録" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/digests");
  await context.close();
});
