import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { ChannelPath } from "#/shared/config/channels";
import { loggedInState } from "./admin";

// WebMCP は実験段階で、Chromium ではフラグを付けたときだけ動く (adr/frontend/0014)
test.use({ launchOptions: { args: ["--enable-features=WebMCP"] } });

// ツールはハイドレーションの後に登録される
const hasNavigate = async (page: Page) => {
  const tools = await page.webmcp.tools();
  return tools.some((t) => t.name === "navigate");
};

test("トップの WebMCP の navigate を呼ぶと、指定した画面に移る", async ({ browser }) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  await page.goto("/");
  await expect.poll(async () => await hasNavigate(page)).toBe(true);
  await page.webmcp.callTool("navigate", {
    to: "/admin/digests/new",
  } satisfies { to: ChannelPath });
  await page.waitForURL((url) => url.pathname === "/admin/digests/new");
  await context.close();
});
