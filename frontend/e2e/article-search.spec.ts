import { expect, test } from "@playwright/test";
import { boardOf, fillDate, loggedInState } from "./admin";

// 同じ DB を使い回し、1 日 1 Digest なので実行ごとに別の日付を使う。digest-repost.spec.ts (1700 年から) とぶつからないよう 1600 年から、1700 年に届かない幅で回す
const dayFrom = (n: number) =>
  new Date(Date.UTC(1600, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

test("公開して登録した記事をタイトルの一部で検索すると、初掲載日とともに 1 件出る", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  const run = Date.now();
  const date = dayFrom(Math.floor(run / 1000) % 30_000);
  const title = `検索される記事 ${run}`;
  const { dragFirstUnsortedTo, collect } = boardOf(page);

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, date);
  await collect(`https://e2e.example/search/${run}`, title);
  await dragFirstUnsortedTo("その他");
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await page.getByRole("button", { name: "公開して登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/admin/articles/search");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("タイトルか URL").fill(String(run));
  await page.getByRole("button", { name: "検索" }).click();
  const rows = page.getByRole("listitem").filter({ hasText: title });
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole("link", { name: title })).toBeVisible();
  await expect(rows).toContainText(
    `${Number(date.slice(0, 4))}年${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`,
  );
});
