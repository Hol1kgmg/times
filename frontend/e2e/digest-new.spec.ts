import { expect, test } from "@playwright/test";
import type { Request } from "@playwright/test";
import { z } from "zod";
import { boardOf, fillDate, loggedInState } from "./admin";

const newPath = "/admin/digests/new";

const openBody = z.looseObject({ event: z.string(), clientId: z.string() });

const isOpen = (event: string) => (r: Request) =>
  r.url().endsWith("/open") &&
  r.method() === "POST" &&
  openBody.safeParse(r.postDataJSON()).data?.event === event;

test("トップを開くと閲覧の記録が送られ、URL を貼って集め、カテゴリへドラッグし、関連記事とホットを付けて登録すると、トップに配置どおり並んで記事を押すと同じ読み手の開いた記録が送られ、フィードに通知が載り、それより前の日付の公開は通知されず、タイムラインの最下段に古い順の続きとして出て、その日に登録を開き直すと編集へ移れる", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: await loggedInState(browser) });
  const page = await context.newPage();
  // 同じ DB を使い回すので、実行ごとに URL を変えて重複 (400) を避ける
  const run = Date.now();
  // 未来の日付は公開できない (specs/010)。e2e の DB は起動ごとに空なので、JST との時差をまたがない 1 年前で最新になる
  const date = new Date(run - 365 * 86_400_000).toISOString().slice(0, 10);
  const { unsorted, dragFirstUnsortedTo, menuOf, collect: collectUrl } = boardOf(page);

  const viewed = page.waitForRequest(isOpen("page_view"));
  await page.goto("/?utm_source=e2e");
  const viewRequest = await viewed;
  const pageView = openBody.parse(viewRequest.postDataJSON());
  expect(pageView).toMatchObject({
    clientId: expect.stringMatching(/^[\da-f-]{36}$/u),
    location: new URL("/", page.url()).href,
  });
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "記事を登録" }).click();
  await page.waitForURL((url) => url.pathname === newPath);
  await fillDate(page, date);

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
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  // 選んだだけでは登録せず、主ボタンが切り替わる
  await expect(page).toHaveURL((url) => url.pathname === newPath);
  await page.getByRole("button", { name: "公開して登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const panel = page.getByRole("region", { name: "最新の Digest" });
  const dateLabel = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(date));
  await expect(panel.getByText(dateLabel, { exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText(["セキュリティ", "その他"]);
  const links = panel.getByRole("link");
  await expect(links).toHaveText([security, related, `${other}HOT`]);
  await expect(links.filter({ hasText: "HOT" })).toHaveText([`${other}HOT`]);
  // 計測のために中継の URL へ差し替えず、コピーで記事の URL が取れること (specs/013)
  const securityUrl = `https://e2e.example/${run}/${encodeURIComponent(security)}`;
  await expect(links.first()).toHaveAttribute("href", securityUrl);
  const opened = page.waitForRequest(isOpen("article_click"));
  const tab = context.waitForEvent("page");
  await links.first().click();
  const openRequest = await opened;
  // 見ただけの記録と押した記録が同じ匿名の読み手として数えられること (specs/014)
  expect(openRequest.postDataJSON()).toEqual({
    event: "article_click",
    clientId: pageView.clientId,
    articleId: expect.stringMatching(/^[\da-f-]{36}$/u),
    url: securityUrl,
    entryDate: date,
  });
  const articleTab = await tab;
  await articleTab.close();
  const feedLinks = async () => {
    const res = await page.request.get("/feed.xml");
    const xml = await res.text();
    return [...xml.matchAll(/\/digest\/(?<date>[\d-]+)<\/link>/gu)].map((m) => m.groups?.date);
  };
  expect(await feedLinks()).toContain(date);

  // 最新より前の日付は公開で登録できるが、フィードには載らない (issue #112)
  const past = new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
  await page.goto(newPath);
  await fillDate(page, past);
  await collect(`過去の記事 ${run}`);
  await dragFirstUnsortedTo("その他");
  await page.getByRole("button", { name: "登録方法を選ぶ" }).click();
  await page.getByRole("menuitemradio", { name: "公開して登録" }).click();
  await page.getByRole("button", { name: "公開して登録" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  expect(await feedLinks()).not.toContain(past);

  await page.getByRole("link", { name: "timeline" }).click();
  await page.waitForURL((url) => url.pathname === "/timeline");
  await expect(page.getByRole("region", { name: dateLabel })).toBeInViewport();
  const dates = await page
    .locator("main time")
    .evaluateAll((els) => els.map((el) => el.getAttribute("datetime") ?? ""));
  expect(dates).toStrictEqual(dates.toSorted((a, b) => a.localeCompare(b)));
  expect(dates.at(-1)).toBe(date);

  // 登録した日を「今日」にして開き直すと、登録済みと伝えて編集へ移れる
  await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
  await page.goto(newPath);
  await page.getByRole("dialog", { name: "今日の記事は登録済みです。編集しますか？" }).waitFor();
  await page.getByRole("link", { name: "編集する" }).click();
  await page.waitForURL((url) => url.pathname === `/admin/digests/${date}/edit`);
  await context.close();
});
