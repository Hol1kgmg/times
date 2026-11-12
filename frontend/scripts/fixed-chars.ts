import { globSync, readFileSync } from "node:fs";

// 固定文字のサブセット (adr/frontend/0005) に入れる文字を標準出力に書く。just fe-font-subset から呼ぶ
const ascii = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i));
// 日付は Intl が組み立てるのでソースに現れない
const dateChars = ["月", "日", "火", "水", "木", "金", "土"];

// トップを速く出すためのものなので、トップとシェルに出る文字だけを入れる。ほかの画面は --font-dynamic で Klee One から取る
const sources = globSync(
  ["src/app/**/*.{ts,tsx}", "src/pages/home/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
  {
    // 日付ピッカーはトップに出ず、モーダルの --font-dynamic で描く。*.server.ts と AI への依頼の文・WebMCP のツールの説明は画面に出ない
    exclude: (f) =>
      /\.(?:test|gen|stories|server)\.tsx?$|date-picker\.tsx$|ai-chat\.ts$|navigate-tool\.ts$/u.test(
        f,
      ),
  },
);
const literals = sources
  .map((f) => readFileSync(f, "utf-8"))
  .join("\n")
  .replaceAll(/\/\*[\s\S]*?\*\//gu, "")
  // URL の "://" を残すため、行頭か空白の直後の // だけをコメントとみなす
  .replaceAll(/(?<head>^|\s)\/\/.*$/gmu, "$<head>");

const nonAscii = literals.match(/\P{ASCII}/gu) ?? [];
process.stdout.write([...new Set([...ascii, ...dateChars, ...nonAscii])].toSorted().join(""));
