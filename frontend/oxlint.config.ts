import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, tanstack, vitest],
  // 生成物 (openapi-typescript 等) は lint 対象外
  ignorePatterns: ["**/*.gen.ts"],
  // ESLint プラグインを oxlint の JS plugin として読み込む。
  // 組み込み Rust 版 `react` と名前が衝突するため eslint-plugin-react は `react-js` で別名
  jsPlugins: [
    { name: "react-js", specifier: "eslint-plugin-react" },
    {
      name: "react-you-might-not-need-an-effect",
      specifier: "eslint-plugin-react-you-might-not-need-an-effect",
    },
  ],
  rules: {
    "react-js/jsx-sort-props": [
      "error",
      { callbacksLast: true, ignoreCase: true, reservedFirst: true },
    ],
    "react-you-might-not-need-an-effect/no-adjust-state-on-prop-change": "warn",
    "react-you-might-not-need-an-effect/no-chain-state-updates": "warn",
    "react-you-might-not-need-an-effect/no-derived-state": "warn",
    "react-you-might-not-need-an-effect/no-event-handler": "warn",
    "react-you-might-not-need-an-effect/no-external-store-subscription": "warn",
    "react-you-might-not-need-an-effect/no-initialize-state": "warn",
    "react-you-might-not-need-an-effect/no-pass-data-to-parent": "warn",
    "react-you-might-not-need-an-effect/no-pass-live-state-to-parent": "warn",
    "react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change": "warn",
  },
  overrides: [
    {
      // Playwright のテスト。vitest プリセットの *.spec.ts マッチから外す。
      // override 内で plugins を宣言しないと vitest/* の rules 指定が無視される
      files: ["e2e/**/*.ts"],
      plugins: ["vitest"],
      rules: {
        "vitest/consistent-test-filename": "off",
        "vitest/prefer-importing-vitest-globals": "off",
      },
    },
  ],
});
