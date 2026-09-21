import parser from "@typescript-eslint/parser";
import preferArrowFunctions from "eslint-plugin-prefer-arrow-functions";

export default [
  {
    // TanStack Router の自動生成ファイル。生成物側にも
    // 「linter/formatter から除外すること」と明記されている。
    // 除外しないと `--fix` 付きの lint が冒頭の `/* eslint-disable */` を
    // 未使用ディレクティブとみなして削除し、毎回差分が発生する。
    ignores: ["src/routeTree.gen.ts"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
    },
    plugins: {
      "prefer-arrow-functions": preferArrowFunctions,
    },
    rules: {
      "prefer-arrow-functions/prefer-arrow-functions": "error",
    },
  },
];
