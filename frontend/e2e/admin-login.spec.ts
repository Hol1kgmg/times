import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

// 前提: `just db-up` と `just be-dev-e2e` (GitHub モックを向いた backend) が起動済み。
// GitHub モックと dev server は playwright.config.ts が起動する
const loginPath = "/e2e-secret-login-path/auth/login";
const loginButton = { name: "GitHub でログイン" };
const logoutButton = { name: "ログアウト" };
// トップページは検索パラメータ (?q=) を補うので pathname で判定する
const atHome = (url: URL) => url.pathname === "/";

// Router 既定の 404 表示。ログインの存在を匂わせる文言が無いこと (SC-005)
const expectNotFound = async (page: Page, path: string) => {
  const res = await page.goto(path);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Not Found")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ログイン");
};

const expectNoLoginUi = async (page: Page) => {
  await page.goto("/");
  await expect(page).toHaveTitle("times");
  await expect(page.locator("body")).not.toContainText("ログイン");
  await expect(page.locator("body")).not.toContainText("ログアウト");
};

// SSR 直後はまだ onClick が付いていない。ハイドレーション完了を待ってから押す
const clickAfterHydration = async (page: Page, button: { name: string }) => {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", button).click();
};

// 秘匿パス → GitHub モック → 選択肢を押す
const authorizeAs = async (page: Page, choice: string) => {
  await page.goto(loginPath);
  await clickAfterHydration(page, loginButton);
  await page.waitForURL(/\/login\/oauth\/authorize/u);
  await page.getByRole("link", { name: choice }).click();
};

const loggedInState = async (browser: Browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await authorizeAs(page, "管理者として承認");
  await page.waitForURL(atHome);
  const state = await context.storageState();
  await context.close();
  return state;
};

test.describe("US1: 管理者専用のページ・処理を管理者だけのものにする", () => {
  test("秘匿パス以外は 404", async ({ page }) => {
    await expectNotFound(page, "/not-the-path");
  });

  test("callback の直叩きは 404", async ({ page }) => {
    await expectNotFound(page, "/auth/github/callback");
  });

  test("state が一致しない callback は 404", async ({ page }) => {
    await expectNotFound(page, "/auth/github/callback?code=admin&state=wrong");
  });

  test("秘匿パスでログインカードが出る", async ({ page }) => {
    await page.goto(loginPath);
    await expect(page).toHaveTitle("times");
    await expect(page.getByRole("heading", { name: "管理者ログイン" })).toBeVisible();
    await expect(page.getByRole("button", loginButton)).toBeVisible();
  });

  test("管理者として承認すると / に移り、ログインの表示は出ない", async ({ page }) => {
    await expectNoLoginUi(page);
    await authorizeAs(page, "管理者として承認");
    await page.waitForURL(atHome);
    await expectNoLoginUi(page);
  });

  test("別のアカウントは許可されない", async ({ page }) => {
    await authorizeAs(page, "別のアカウントで承認");
    await page.waitForURL(`${loginPath}?error=forbidden`);
    await expect(page.getByText("このアカウントは管理者として許可されていません")).toBeVisible();
    await expect(page.getByRole("button", loginButton)).toBeVisible();
  });

  test("キャンセルするとログイン画面に戻る", async ({ page }) => {
    await authorizeAs(page, "キャンセル");
    await page.waitForURL(`${loginPath}?error=cancelled`);
    await expect(page.getByText("GitHub での承認がキャンセルされました")).toBeVisible();
  });
});

test.describe("US2: ログイン状態を保ち、任意にログアウトする", () => {
  test("Cookie を引き継いだ新しいコンテキストでログイン中になる", async ({ browser }) => {
    const storageState = await loggedInState(browser);
    const admin = storageState.cookies.find((c) => c.name === "times_admin");
    expect(admin?.httpOnly).toBeTruthy();
    const days = ((admin?.expires ?? 0) - Date.now() / 1000) / 86_400;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);

    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto(loginPath);
    await expect(page.getByText("ログイン中: octocat")).toBeVisible();
    await expect(page.getByRole("button", logoutButton)).toBeVisible();
    await expect(page.getByRole("button", loginButton)).toHaveCount(0);
    await context.close();
  });

  test("ログアウトすると / に移り、秘匿パスはログインカードに戻る", async ({ browser }) => {
    const context = await browser.newContext({ storageState: await loggedInState(browser) });
    const page = await context.newPage();
    await page.goto(loginPath);
    await clickAfterHydration(page, logoutButton);
    await page.waitForURL(atHome);
    await expectNoLoginUi(page);
    await page.goto(loginPath);
    await expect(page.getByRole("button", loginButton)).toBeVisible();
    await context.close();
  });

  test("ログアウトすると同じ Cookie を持つ別のコンテキストも失効する", async ({ browser }) => {
    // backend の session 行が消えるので、古い Cookie を持つ側もログインカードに戻る (SC-004)。
    // logout 自体の冪等性 (Cookie なし / 401) は logout.test.ts と backend の go test で検証する
    const storageState = await loggedInState(browser);
    const first = await browser.newContext({ storageState });
    const second = await browser.newContext({ storageState });
    const page = await first.newPage();
    await page.goto(loginPath);
    await clickAfterHydration(page, logoutButton);
    await page.waitForURL(atHome);

    const stale = await second.newPage();
    await stale.goto(loginPath);
    await expect(stale.getByRole("button", loginButton)).toBeVisible();
    await expect(stale.getByRole("button", logoutButton)).toHaveCount(0);
    await first.close();
    await second.close();
  });
});
