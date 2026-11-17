import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { boardOf, fillDate, loggedInState } from "./admin";

// 同じ DB を使い回し、1 日 1 Digest なので実行ごとに別の日付を使う。digest-edit.spec.ts (1900 年から) とぶつからないよう 1700 年から数える
const dayFrom = (n: number) =>
  new Date(Date.UTC(1700, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

const publish = async (page: Page) => {
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await page.getByRole("button", { name: "公開して登録" }).click();
};

const previewLinks = async (page: Page) => {
  await page.getByRole("button", { name: "プレビュー" }).click();
  return page.getByRole("dialog").getByRole("link");
};

test("公開済みの Digest に子として載っている記事を親、新しい記事を子にして別の日に登録すると、再掲載として通って編集画面のその行に案内が出て、読み直すと親の下に子が並び、元の日の Digest では元の親の子のまま後の子が出ない", async ({
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
  const earlierParent = `前の親 ${run}`;
  const original = `元の記事 ${run}`;
  const followUp = `続報 ${run}`;

  // 再掲載の条件は親子を問わず公開済みの掲載があること (FR-005)。子だった掲載で通れば親だった掲載でも通る
  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, first);
  await collect(earlierParent);
  await collect(original);
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await menuOf(original, "上の記事の関連記事にする");
  await publish(page);
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/admin/digests/new");
  await page.waitForLoadState("networkidle");
  await fillDate(page, repost);
  await collect(original);
  await collect(followUp);
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await menuOf(followUp, "上の記事の関連記事にする");
  await publish(page);

  // 再掲載は記事行で知らせるので、トップではなく保存した Digest の編集画面へ移る (specs/018 R6)
  await page.waitForURL((url) => url.pathname === `/admin/digests/${repost}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("listitem").filter({ hasText: original }).first()).toContainText(
    "再掲載として登録しました",
  );
  await expect(await previewLinks(page)).toHaveText([original, followUp]);
  await expect(
    page.getByRole("dialog").getByRole("listitem").filter({ hasText: original }).getByRole("list"),
  ).toContainText(followUp);
  await expect(
    page.getByRole("dialog").getByRole("listitem").filter({ hasText: original }).first(),
  ).toContainText("再掲載");
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();

  // 後の日に付けた子は、元の日の Digest には出ない (FR-012)
  await page.goto(`/admin/digests/${first}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(await previewLinks(page)).toHaveText([earlierParent, original]);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("listitem")
      .filter({ hasText: earlierParent })
      .getByRole("list"),
  ).toContainText(original);
  // 印は前の日の掲載だけで決まり、後の日の再掲載で元の日に付かない (FR-010)
  await expect(page.getByRole("dialog")).not.toContainText("再掲載");
  await context.close();
});
