import { expect } from "@playwright/test";
import type { Browser, Locator, Page } from "@playwright/test";

// 前提: `just db-up` と `just be-dev-e2e` が起動済み (admin-login.spec.ts と同じ)
const loginPath = "/e2e-secret-login-path/auth/login";

export const loggedInState = async (browser: Browser) => {
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

const centerOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("drag target is not visible");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// DateField は欄ごとの spinbutton で、年の欄から数字を打つと月・日の欄へ進む
export const fillDate = async (page: Page, date: string) => {
  await page.getByRole("spinbutton", { name: /^年/u }).click();
  await page.keyboard.type(date.replaceAll("-", ""));
};

// 登録画面・編集画面の箱とカードの操作
export const boardOf = (page: Page) => {
  const boxOf = (name: string) =>
    page.getByRole("heading", { level: 2, name: new RegExp(`^${name}`, "u") }).locator("..");
  const unsorted = boxOf("未分類");
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
  // 親の行は関連記事の行とメニューを中に含むので、いちばん内側の行の先頭のメニューを押す
  const menuOf = async (title: string, item: string) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: title })
      .last()
      .getByRole("button", { name: "メニュー" })
      .first()
      .click();
    await page.getByRole("menuitem", { name: item }).click();
  };
  // e2e.example は名前解決できないのでタイトルは取れず、手で入れる経路を通る
  const collect = async (url: string, title: string) => {
    const urlInput = page.getByLabel("記事の URL");
    await urlInput.fill(url);
    await urlInput.press("Enter");
    const card = unsorted.getByRole("listitem").last();
    await expect(card.getByText("タイトルを入れてください")).toBeVisible();
    await card.getByRole("button", { name: "メニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();
    // 閉じたダイアログはフェードアウトの間 DOM に残るので、開いているものに絞って閉じきるまで待つ
    const dialog = page.getByRole("dialog", { name: "記事を編集" });
    await dialog.getByLabel("タイトル", { exact: true }).fill(title);
    await dialog.getByRole("button", { name: "確定" }).click();
    await expect(dialog).toBeHidden();
  };
  return { unsorted, boxOf, dragFirstUnsortedTo, menuOf, collect };
};
