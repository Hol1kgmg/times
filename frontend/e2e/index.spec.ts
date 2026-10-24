import { expect, test } from "@playwright/test";

// e2e の DB は使い回すので Digest の有無が定まらない。どちらの表示でも崩れないことを見る。
// Digest の登録から表示までは digest-new.spec.ts が通す
test("トップページにサイトの説明と、最新の Digest か「まだ記事がない」が出る", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("z_times.dev");
  await expect(page.getByRole("heading", { level: 1, name: "z_times.dev" })).toBeVisible();
  await expect(page.getByText("日ごとにゆるくまとめてます")).toBeVisible();
  const panel = page.getByRole("region", { name: "最新の Digest" });
  await expect(panel.locator("article").or(panel.getByText("まだ記事がありません"))).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "ゆるい説明" })).toBeVisible();
});
