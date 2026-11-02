import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loggedInState } from "./admin";

// 前提: `just db-up` と `just be-dev-e2e` (GitHub モックを向いた backend) が起動済み。
// GitHub モックと dev server は playwright.config.ts が起動する。
// 404・キャンセル・別アカウントなどの分岐は complete-github-login.test.ts と login-config.server.test.ts で検証する
const loginPath = "/e2e-secret-login-path/auth/login";
const loginButton = { name: "GitHub でログイン" };
const logoutButton = { name: "ログアウト" };

// SSR 直後はまだ onClick が付いていない。ハイドレーション完了を待ってから押す
const clickAfterHydration = async (page: Page, button: { name: string }) => {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", button).click();
};

test("管理者として承認した Cookie は別のコンテキストでもログイン中として通り、ログアウトすると同じ Cookie を持つ側も失効する", async ({
  browser,
}) => {
  const storageState = await loggedInState(browser);
  const admin = storageState.cookies.find((c) => c.name === "times_admin");
  expect(admin?.httpOnly).toBeTruthy();
  const days = ((admin?.expires ?? 0) - Date.now() / 1000) / 86_400;
  expect(days).toBeGreaterThan(29);
  expect(days).toBeLessThan(31);

  const first = await browser.newContext({ storageState });
  const second = await browser.newContext({ storageState });
  const page = await first.newPage();
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "チャンネル" });
  await expect(nav.getByRole("link", { name: "ログアウト" })).toHaveAttribute("href", loginPath);
  await page.goto(loginPath);
  await expect(page.getByText("ログイン中: octocat")).toBeVisible();

  await clickAfterHydration(page, logoutButton);
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto(loginPath);
  await expect(page.getByRole("button", loginButton)).toBeVisible();

  // backend の session 行が消えるので、古い Cookie を持つ側もログインカードに戻る (SC-004)
  const stale = await second.newPage();
  await stale.goto(loginPath);
  await expect(stale.getByRole("button", loginButton)).toBeVisible();
  await expect(stale.getByRole("button", logoutButton)).toHaveCount(0);
  await first.close();
  await second.close();
});
