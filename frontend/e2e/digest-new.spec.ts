import { expect, test } from "@playwright/test";
import { boardOf, loggedInState } from "./admin";

const newPath = "/admin/digests/new";

test("未ログインでは登録ページは 404 で、サイドバーに管理者向けのタブが出ない", async ({
  page,
}) => {
  const res = await page.goto(newPath);
  expect(res?.status()).toBe(404);
  const listRes = await page.goto("/admin/digests");
  expect(listRes?.status()).toBe(404);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "チャンネル" });
  await expect(nav.getByRole("link", { name: "general" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "記事を登録" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "記事を編集" })).toHaveCount(0);
});

test("URL を貼って集め、カテゴリへドラッグし、関連記事とホットを付けて登録すると、トップに配置どおり並ぶ", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  // 同じ DB を使い回すので、実行ごとに URL を変えて重複 (400) を避ける
  const run = Date.now();
  // 1 日 1 Digest で、トップに最新として出したいので、実行ごとに前回より後の日付にする (1 分ごとに 1 日進む)
  const date = new Date(
    Date.UTC(2100, 0, 1) + Math.floor((run - Date.UTC(2026, 9, 28)) / 60_000) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const { unsorted, dragFirstUnsortedTo, menuOf, collect: collectUrl } = boardOf(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "記事を登録" }).click();
  await page.waitForURL((url) => url.pathname === newPath);
  await page.getByLabel("日付").fill(date);

  const collect = async (title: string) => {
    await collectUrl(`https://e2e.example/${run}/${encodeURIComponent(title)}`, title);
  };
  const security = `セキュリティの記事 ${run}`;
  const related = `関連記事 ${run}`;
  const other = `その他の記事 ${run}`;
  await collect(security);
  await collect(related);
  await collect(other);
  await expect(page.getByRole("button", { name: "下書きで登録" })).toBeDisabled();

  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("セキュリティ");
  await dragFirstUnsortedTo("その他");
  await expect(unsorted.getByText("ここにドラッグ")).toBeVisible();

  await menuOf(related, "上の記事の関連記事にする");
  await menuOf(other, "ホットにする");
  await expect(page.getByRole("button", { name: "下書きで登録" })).toBeEnabled();

  // 既定の下書きはトップに出ないので、▼ で公開に切り替えてから登録する (specs/006)
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("button", { name: "公開して登録" }).click();
  // 選んだだけでは登録せず、主ボタンが切り替わる
  await expect(page).toHaveURL((url) => url.pathname === newPath);
  await page.getByRole("button", { name: "公開して登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const panel = page.getByRole("region", { name: "最新の Digest" });
  await expect(
    panel.getByText(
      new Intl.DateTimeFormat("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(date)),
      { exact: true },
    ),
  ).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText(["セキュリティ", "その他"]);
  const links = panel.getByRole("link");
  await expect(links).toHaveText([security, related, `${other}HOT`]);
  await expect(links.filter({ hasText: "HOT" })).toHaveText([`${other}HOT`]);
  await context.close();
});
