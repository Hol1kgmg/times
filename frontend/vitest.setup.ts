import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 各テスト後に React Testing Library がマウントした DOM を破棄する。
// 同位配置したテストが同一ファイル内で複数 render する場合の相互汚染を防ぐ。
afterEach(() => {
  cleanup();
});
