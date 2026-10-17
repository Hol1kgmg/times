import { expect, test } from "@playwright/test";

// DB は開発用と共用で Digest の有無が定まらない。どちらの表示でも崩れないことを見る。
// Digest の登録から表示までは digest-new.spec.ts が通す
test("トップページに最新の Digest か「まだ記事がない」が出る", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("times");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1 }).or(main.getByText("まだ記事がありません")),
  ).toBeVisible();
});
