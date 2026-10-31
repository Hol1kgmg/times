import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { boardOf, loggedInState } from "./admin";

// 同じ DB を使い回し、1 日 1 Digest なので実行ごとに別の日付を使う。トップの最新を digest-new.spec.ts から奪わないよう過去にする
const dayFrom = (n: number) =>
  new Date(Date.UTC(1900, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

// 一覧は最新の年だけ開いていて、digest-new.spec.ts の Digest がそれより後の年を占める
const openDigest = async (page: Page, date: string) => {
  const year = page.getByRole("button", { name: `${Number(date.slice(0, 4))} 年` });
  if ((await year.getAttribute("aria-expanded")) === "false") {
    await year.click();
  }
  await page.locator(`a[href="/admin/digests/${date}/edit"]`).click();
};

const previewLinks = async (page: Page) => {
  await page.getByRole("button", { name: "プレビュー" }).click();
  return page.getByRole("dialog").getByRole("link");
};

test("一覧から登録済みの Digest を開き、タイトル・記事・日付を直して保存すると、開き直したときに直した内容で並ぶ", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  const run = Date.now();
  const base = (Math.floor(run / 1000) % 30_000) * 2;
  const date = dayFrom(base);
  const moved = dayFrom(base + 1);
  const { dragFirstUnsortedTo, menuOf, collect: collectUrl } = boardOf(page);
  const collect = async (title: string) => {
    await collectUrl(`https://e2e.example/edit/${run}/${encodeURIComponent(title)}`, title);
  };
  const security = `セキュリティの記事 ${run}`;
  const related = `関連記事 ${run}`;
  const other = `その他の記事 ${run}`;
  const fixed = `直したタイトル ${run}`;

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("日付").fill(date);
  await collect(security);
  await collect(related);
  await collect(other);
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("その他");
  await menuOf(related, "上の記事の関連記事にする");
  await menuOf(other, "ホットにする");
  await page.getByRole("button", { name: "登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page
    .getByRole("navigation", { name: "チャンネル" })
    .getByRole("link", { name: "記事を編集" })
    .click();
  await page.waitForURL((url) => url.pathname === "/admin/digests");
  await openDigest(page, date);
  await page.waitForURL((url) => url.pathname === `/admin/digests/${date}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("日付")).toHaveValue(date);
  await expect(await previewLinks(page)).toHaveText([security, related, `${other}HOT`]);
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();

  await menuOf(security, "編集");
  await page.getByLabel("タイトル").fill(fixed);
  await page.getByRole("button", { name: "確定" }).click();
  await menuOf(related, "削除");
  await page.getByLabel("日付").fill(moved);
  await page.getByRole("button", { name: "保存" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/digests");

  await expect(page.locator(`a[href="/admin/digests/${moved}/edit"]`)).toHaveCount(1);
  await expect(page.locator(`a[href="/admin/digests/${date}/edit"]`)).toHaveCount(0);
  await openDigest(page, moved);
  await page.waitForURL((url) => url.pathname === `/admin/digests/${moved}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(await previewLinks(page)).toHaveText([fixed, `${other}HOT`]);
  await context.close();
});
