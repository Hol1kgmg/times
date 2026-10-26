import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

// public/og.png を書き出す。just fe-og-image から呼ぶ
// ロゴはアニメーション中の、ワードマークが右に傾きベルが振り切った瞬間で止める
const LOGO_DURATION_MS = 2100;
const LOGO_PAUSE_AT = 0.65;

const logo = readFileSync("../docs/logo.svg", "utf-8").replace(
  'viewBox="0 0 1100 512"',
  'viewBox="100 118 985 250" width="760"',
);
const kleeOneCss = path.resolve("node_modules/@fontsource/klee-one/400.css");

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="file://${kleeOneCss}">
<style>
  body { margin: 0; width: 1200px; height: 630px; font-family: "Klee One";
    background: linear-gradient(135deg, #ff6b35, #fff4ee 120%); }
  .frame { position: absolute; inset: 32px; background: #fff; border-radius: 24px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; }
  p { margin: 0; font-size: 36px; line-height: 1.6; color: #444; text-align: center; }
</style>
<div class="frame">${logo}<p>見かけて気になった技術や趣味の記事を、<br>日ごとにゆるくまとめてます。</p></div>`;

// file:// の CSS は about:blank から読めないので、HTML も file:// で開く
const dir = mkdtempSync(path.join(tmpdir(), "og-"));
const browser = await chromium.launch();
try {
  writeFileSync(path.join(dir, "og.html"), html);
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`file://${path.join(dir, "og.html")}`);
  await page.evaluate(async () => await document.fonts.ready);
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, LOGO_DURATION_MS * LOGO_PAUSE_AT);
  await page.screenshot({ path: "public/og.png" });
} finally {
  await browser.close();
  rmSync(dir, { recursive: true });
}
