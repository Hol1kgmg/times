import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, tanstack, vitest],
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
