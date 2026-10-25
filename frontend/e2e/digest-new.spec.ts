import { expect, test } from "@playwright/test";
import type { Browser, Locator } from "@playwright/test";

// 前提: `just db-up` と `just be-dev-e2e` が起動済み (admin-login.spec.ts と同じ)
const loginPath = "/e2e-secret-login-path/auth/login";
const newPath = "/admin/digests/new";

const centerOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("drag target is not visible");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

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

test("URL を貼って集め、カテゴリへドラッグし、関連記事とホットを付けて登録すると、トップに配置どおり並ぶ", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  // 同じ DB を使い回すので、実行ごとに URL を変えて重複 (400) を避ける
  const run = Date.now();
  const date = "2099-12-31";
  const boxOf = (name: string) =>
    page
      .locator("section")
      .filter({ has: page.getByRole("button", { name: new RegExp(`^${name}`, "u") }) });
  const unsorted = boxOf("未分類");
  // dnd-kit はポインターの移動量でドラッグを始めるので、1 回の dragTo ではなく刻んで動かす
  // dnd-kit はポインターの移動量でドラッグを始めるので刻んで動かす。
  // 途中で通った箱に記事が入ると下の箱がずれるので、着いてから見出しの位置を測り直す
  const dragFirstUnsortedTo = async (name: string) => {
    const header = boxOf(name).getByRole("button", { name: new RegExp(`^${name}`, "u") });
    const from = await centerOf(unsorted.getByRole("button", { name: "並べ替え" }).first());
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const to = await centerOf(header);
    await page.mouse.move(to.x, to.y, { steps: 20 });
    const settled = await centerOf(header);
    await page.mouse.move(settled.x, settled.y, { steps: 5 });
    await page.mouse.up();
    // 落とすアニメーションの間に次のドラッグを始めると無視される
    await expect(page.locator("[data-dnd-dragging], [data-dnd-dropping]")).toHaveCount(0);
  };
  const menuOf = async (title: string, item: string) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: title })
      .getByRole("button", { name: "メニュー" })
      .last()
      .click();
    await page.getByRole("button", { name: item }).click();
  };

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "記事を登録" }).click();
  await page.waitForURL((url) => url.pathname === newPath);
  await page.getByLabel("日付").fill(date);

  // e2e.example は名前解決できないのでタイトルは取れず、手で入れる経路を通る
  const collect = async (title: string) => {
    const urlInput = page.getByLabel("記事の URL");
    await urlInput.fill(`https://e2e.example/${run}/${encodeURIComponent(title)}`);
    await urlInput.press("Enter");
    const card = unsorted.getByRole("listitem").last();
    await expect(card.getByText("タイトルを入れてください")).toBeVisible();
    await card.getByRole("button", { name: "メニュー" }).click();
    await page.getByRole("button", { name: "編集" }).click();
    await page.getByLabel("タイトル").fill(title);
    await page.getByRole("button", { name: "確定" }).click();
  };
  const security = `セキュリティの記事 ${run}`;
  const related = `関連記事 ${run}`;
  const other = `その他の記事 ${run}`;
  await collect(security);
  await collect(related);
  await collect(other);
  await expect(page.getByRole("button", { name: "登録" })).toBeDisabled();

  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("その他");
  await expect(unsorted.getByText("ここにドラッグ")).toBeVisible();

  await menuOf(related, "上の記事の関連記事にする");
  await menuOf(other, "ホットにする");

  await page.getByRole("button", { name: "登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const panel = page.getByRole("region", { name: "最新の Digest" });
  await expect(panel.getByText("12月31日(木)", { exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText(["セキュリティ", "その他"]);
  const links = panel.getByRole("link");
  await expect(links).toHaveText([security, related, `${other}HOT`]);
  await expect(links.filter({ hasText: "HOT" })).toHaveText([`${other}HOT`]);
  await context.close();
});
