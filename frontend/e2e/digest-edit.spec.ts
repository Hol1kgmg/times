import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { boardOf, fillDate, loggedInState } from "./admin";

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

// 記事の id は画面に出ないので、開いたときのサーバー関数のレスポンスから Digest と記事の id を拾う
const idsOnOpen = async (page: Page, date: string, title: string) => {
  const response = page.waitForResponse(async (res) => {
    const text = await res.text().catch(() => "");
    return res.url().includes("/_serverFn/") && text.includes(title);
  });
  await openDigest(page, date);
  const res = await response;
  const text = await res.text();
  return new Set(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu));
};

const previewLinks = async (page: Page) => {
  await page.getByRole("button", { name: "プレビュー" }).click();
  return page.getByRole("dialog").getByRole("link");
};

// HOT の吹き出しはリンクの外に置く (specs/015) ので、吹き出しのある行のリンクで見る
const hotLinks = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("listitem")
    .filter({ has: page.getByRole("img", { name: "HOT" }) })
    .getByRole("link");

test("下書きで登録した Digest を一覧から開き、タイトル・記事・日付を直して公開で保存すると、開き直したときに直した内容で並び公開になっていて、残した記事の id は変わらない", async ({
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
  await fillDate(page, date);
  await collect(security);
  await collect(related);
  await collect(other);
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("その他");
  await menuOf(related, "上の記事の関連記事にする");
  await menuOf(other, "ホットにする");
  await page.getByRole("button", { name: "下書きで登録" }).click();
  // 下書きはトップに出ないので、登録後は一覧へ移る
  await page.waitForURL((url) => url.pathname === "/admin/digests");
  await expect(page.locator(`a[href="/admin/digests/${date}/edit"]`)).toContainText("下書き");
  // Digest と記事 3 件
  const before = await idsOnOpen(page, date, other);
  expect(before.size).toBe(4);
  await page.waitForURL((url) => url.pathname === `/admin/digests/${date}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("group", { name: "日付" })).toHaveText(date.replaceAll("-", "/"));
  await expect(await previewLinks(page)).toHaveText([security, related, other]);
  await expect(hotLinks(page)).toHaveText([other]);
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();

  await menuOf(security, "編集");
  await page.getByLabel("タイトル", { exact: true }).fill(fixed);
  await page.getByRole("button", { name: "確定" }).click();
  await menuOf(related, "削除");
  await fillDate(page, moved);
  await page.getByRole("button", { name: "保存方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して保存" }).click();
  await page.getByRole("button", { name: "公開して保存" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/digests");

  await expect(page.locator(`a[href="/admin/digests/${moved}/edit"]`)).not.toContainText("下書き");
  await expect(page.locator(`a[href="/admin/digests/${date}/edit"]`)).toHaveCount(0);
  // タイトルを直した記事もホットの記事も、日付を動かした Digest も id を保ち、新しい id は振られない
  const after = await idsOnOpen(page, moved, other);
  expect(after.size).toBe(3);
  expect([...after].every((id) => before.has(id))).toBe(true);
  await page.waitForURL((url) => url.pathname === `/admin/digests/${moved}/edit`);
  await page.waitForLoadState("networkidle");
  // 公開した後のメニューに下書きはない
  await page.getByRole("button", { name: "保存方法を選ぶ" }).click();
  await expect(page.getByRole("menu").getByRole("menuitemradio")).toHaveText([
    "公開のまま保存",
    "非公開にして保存",
  ]);
  await page.keyboard.press("Escape");
  await expect(await previewLinks(page)).toHaveText([fixed, other]);
  await expect(hotLinks(page)).toHaveText([other]);
  await context.close();
});
