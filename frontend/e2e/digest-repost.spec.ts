import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { boardOf, fillDate, loggedInState } from "./admin";

// 同じ DB を使い回し、1 日 1 Digest なので実行ごとに別の日付を使う。digest-edit.spec.ts (1900 年から) とぶつからないよう 1700 年から数え、1 回の実行で 6 日使うので 1900 年に届かない幅で回す
const dayFrom = (n: number) =>
  new Date(Date.UTC(1700, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

test("公開済みの記事を親、新しい記事を子にして別の日に登録すると、断られてその行が再掲載に切り替わり、登録し直すと再掲載の親の下に子が並ぶ", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  const run = Date.now();
  const base = (Math.floor(run / 1000) % 12_000) * 6;
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

// 親と子を公開した日のあと、子だけを別の日に入れ、断られて切り替わった再掲載のまま公開する
const repostChildElsewhere = async (page: Page, offset: number) => {
  const run = Date.now();
  const base = (Math.floor(run / 1000) % 12_000) * 6 + offset;
  const first = dayFrom(base);
  const repost = dayFrom(base + 1);
  const { dragFirstUnsortedTo, menuOf, collect: collectUrl } = boardOf(page);
  const collect = async (title: string) => {
    await collectUrl(`https://e2e.example/repost/${run}/${encodeURIComponent(title)}`, title);
  };
  const publish = page.getByRole("button", { name: "公開して登録" });
  const parent = `親の記事 ${run}`;
  const child = `子の記事 ${run}`;
  // 親子を外しても元の日の Digest が空にならないよう残す
  const kept = `残す記事 ${run}`;

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, first);
  await collect(parent);
  await collect(child);
  await collect(kept);
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("その他");
  await menuOf(child, "上の記事の関連記事にする");
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await publish.click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, repost);
  await collect(child);
  await dragFirstUnsortedTo("IT系");
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await publish.click();
  await expect(page.getByRole("listitem").filter({ hasText: child }).first()).toContainText(
    "再掲載にしました",
  );
  await publish.click();
  await page.waitForURL((url) => url.pathname === "/");
  return { first, repost, parent, child };
};

test("公開済みの子の記事だけを別の日に再掲載すると、その日を開き直したときに元の親が再掲載の行として呼び出され、その下に子が並ぶ", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  const { repost, parent, child } = await repostChildElsewhere(page, 2);

  await page.goto(`/admin/digests/${repost}/edit`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "プレビュー" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link")).toHaveText([parent, child]);
  const row = dialog.getByRole("listitem").filter({ hasText: parent }).first();
  await expect(row).toContainText("再掲載");
  await expect(row.getByRole("list")).toContainText(child);
  await context.close();
});

test("子がほかの日に載っている親を元の日から外して保存すると、断られて隠した行に戻り、保存し直すと子の日では親が非公開記事になる", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  const { first, repost, parent, child } = await repostChildElsewhere(page, 4);
  const { menuOf } = boardOf(page);
  const save = page.getByRole("button", { name: "公開のまま保存" });

  await page.goto(`/admin/digests/${first}/edit`);
  await page.waitForLoadState("networkidle");
  // 関連記事ごと消す確認に答える
  page.once("dialog", async (d) => {
    await d.accept();
  });
  await menuOf(parent, "削除");
  await save.click();
  // 自動では保存し直さないので、戻した行を見せたまま同じ画面に留まる
  const hidden = page.getByRole("listitem").filter({ hasText: parent }).first();
  await expect(hidden).toContainText("外す代わりに隠してます");
  await expect(hidden.getByRole("button", { name: "表示に戻す" })).toBeVisible();
  await save.click();
  await page.waitForURL((url) => url.pathname === "/admin/digests");

  await page.goto(`/admin/digests/${repost}/edit`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "プレビュー" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link")).toHaveText([child]);
  await expect(dialog).toContainText("非公開記事");
  await context.close();
});
