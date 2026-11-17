import { expect, test } from "@playwright/test";
import { boardOf, fillDate, loggedInState } from "./admin";

// 同じ DB を使い回し、1 日 1 Digest なので実行ごとに別の日付を使う。digest-edit.spec.ts (1900 年から) とぶつからないよう 1700 年から数える
const dayFrom = (n: number) =>
  new Date(Date.UTC(1700, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

test("公開済みの記事を親、新しい記事を子にして別の日に登録すると、断られてその行が再掲載に切り替わり、登録し直すと再掲載の親の下に子が並ぶ", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  const run = Date.now();
  const base = (Math.floor(run / 1000) % 30_000) * 2;
  const first = dayFrom(base);
  const repost = dayFrom(base + 1);
  const { dragFirstUnsortedTo, menuOf, collect: collectUrl } = boardOf(page);
  const collect = async (title: string) => {
    await collectUrl(`https://e2e.example/repost/${run}/${encodeURIComponent(title)}`, title);
  };
  const publish = page.getByRole("button", { name: "公開して登録" });
  const original = `元の記事 ${run}`;
  const followUp = `続報 ${run}`;

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, first);
  await collect(original);
  await dragFirstUnsortedTo("セキュリティ");
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await publish.click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, repost);
  await collect(original);
  await collect(followUp);
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await menuOf(followUp, "上の記事の関連記事にする");
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await publish.click();

  // 自動では登録し直さないので、切り替えた行を見せたまま同じ画面に留まる (contracts/ui.md)
  await expect(page.getByRole("listitem").filter({ hasText: original }).first()).toContainText(
    "再掲載にしました",
  );
  await publish.click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto(`/admin/digests/${repost}/edit`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "プレビュー" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link")).toHaveText([original, followUp]);
  const parent = dialog.getByRole("listitem").filter({ hasText: original }).first();
  await expect(parent).toContainText("再掲載");
  await expect(parent.getByRole("list")).toContainText(followUp);
  await context.close();
});
