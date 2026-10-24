import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";

// 前提: `just db-up` と `just be-dev-e2e` が起動済み (admin-login.spec.ts と同じ)
const loginPath = "/e2e-secret-login-path/auth/login";
const newPath = "/admin/digests/new";

const loggedInState = async (browser: Browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(loginPath);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "GitHub でログイン" }).click();
  await page.waitForURL(/\/login\/oauth\/authorize/u);
  await page.getByRole("link", { name: "管理者として承認" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const state = await context.storageState();
  await context.close();
  return state;
};

test("未ログインでは登録ページは 404 で、サイドバーに管理者向けのタブが出ない", async ({
  page,
}) => {
  const res = await page.goto(newPath);
  expect(res?.status()).toBe(404);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "チャンネル" });
  await expect(nav.getByRole("link", { name: "general" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "記事を登録" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "item-1" })).toHaveCount(0);
});

test("日付・URL・タイトル・分類・ホットを登録すると、固定順で並び、ホットの記事にだけ HOT の印が付く", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  // 同じ DB を使い回すので、実行ごとに URL を変えて重複 (400) を避ける
  const run = Date.now();
  const date = "2099-12-31";

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "記事を登録" }).click();
  await page.waitForURL((url) => url.pathname === newPath);
  await page.getByLabel("日付").fill(date);

  const fillRow = async (i: number, url: string, title: string, cat: string) => {
    await page.locator(`[name="url-${i}"]`).fill(url);
    await page.locator(`[name="title-${i}"]`).fill(title);
    await page.locator(`[name="category-${i}"]`).selectOption(cat);
  };
  await fillRow(0, `https://e2e.example/${run}/1`, `その他の記事 ${run}`, "その他");
  await page.getByRole("button", { name: "行を追加" }).click();
  await fillRow(1, `https://e2e.example/${run}/2`, `セキュリティの記事 ${run}`, "セキュリティ");
  await page.getByRole("button", { name: "行を追加" }).click();
  await fillRow(2, `https://e2e.example/${run}/3`, `その他の記事 2 ${run}`, "その他");
  // 2 行目 (セキュリティ) に関連記事を 1 件。親の直下に出る
  await page.locator('[name="add-child-1"]').click();
  await page.locator('[name="url-1-0"]').fill(`https://e2e.example/${run}/2/child`);
  await page.locator('[name="title-1-0"]').fill(`関連記事 ${run}`);
  // 3 行目 (その他) をホットにし、関連記事も付ける。印は親にだけ付く
  await page.locator('[name="hot-2"]').check();
  await page.locator('[name="add-child-2"]').click();
  await page.locator('[name="url-2-0"]').fill(`https://e2e.example/${run}/3/child`);
  await page.locator('[name="title-2-0"]').fill(`ホットの関連記事 ${run}`);

  await page.getByRole("button", { name: "登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const panel = page.getByRole("region", { name: "最新の Digest" });
  await expect(panel.getByText("12月31日(木)", { exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText(["セキュリティ", "その他"]);
  const links = panel.getByRole("link");
  await expect(links).toHaveText([
    `セキュリティの記事 ${run}`,
    `関連記事 ${run}`,
    `その他の記事 ${run}`,
    `その他の記事 2 ${run}HOT`,
    `ホットの関連記事 ${run}`,
  ]);
  await expect(links.filter({ hasText: "HOT" })).toHaveText([`その他の記事 2 ${run}HOT`]);
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await context.close();
});
