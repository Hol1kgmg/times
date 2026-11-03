import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

// public/og.png と、フィード画像の下地 backend/internal/feed/og-base.png を書き出す。just fe-og-image から呼ぶ
// ロゴはアニメーション中の、ワードマークが右に傾きベルが振り切った瞬間で止める
const LOGO_DURATION_MS = 2100;
const LOGO_PAUSE_AT = 0.65;

const logoSvg = readFileSync("../docs/logo.svg", "utf-8");
const logo = (width: number) =>
  logoSvg.replace('viewBox="0 0 1100 512"', `viewBox="100 118 985 250" width="${width}"`);
const kleeOneCss = path.resolve("node_modules/@fontsource/klee-one/400.css");

const page = (frameCss: string, body: string) => `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="file://${kleeOneCss}">
<style>
  body { margin: 0; width: 1200px; height: 630px; font-family: "Klee One";
    background: linear-gradient(135deg, #ff6b35, #fff4ee 120%); }
  .frame { position: absolute; inset: 32px; background: #fff; border-radius: 24px;
    display: flex; flex-direction: column; align-items: center; ${frameCss} }
  p { margin: 0; font-size: 36px; line-height: 1.6; color: #444; text-align: center; }
</style>
<div class="frame">${body}</div>`;

const description = "見かけて気になった技術や趣味の記事を、<br>日ごとにゆるくまとめてます。";
// ponytail: 下地は仮のレイアウト。中央の日付は backend/internal/feed が描くので空けておく (specs/010 T033 で決める)
const outputs = {
  "public/og.png": page("justify-content: center; gap: 40px;", `${logo(760)}<p>${description}</p>`),
  "../backend/internal/feed/og-base.png": page(
    "justify-content: space-between; padding: 40px 0; box-sizing: border-box;",
    `${logo(420)}<p style="font-size: 28px">${description}</p>`,
  ),
};

// file:// の CSS は about:blank から読めないので、HTML も file:// で開く
const dir = mkdtempSync(path.join(tmpdir(), "og-"));
const browser = await chromium.launch();
try {
  await Promise.all(
    Object.entries(outputs).map(async ([out, html], i) => {
      const file = path.join(dir, `og-${i}.html`);
      writeFileSync(file, html);
      const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
      await tab.goto(`file://${file}`);
      await tab.evaluate(async () => await document.fonts.ready);
      await tab.evaluate((t) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = t;
        }
      }, LOGO_DURATION_MS * LOGO_PAUSE_AT);
      await tab.screenshot({ path: out });
      await tab.close();
    }),
  );
} finally {
  await browser.close();
  rmSync(dir, { recursive: true });
}
