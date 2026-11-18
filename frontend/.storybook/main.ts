import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import type { PluginOption } from "vite";

const withoutTanstack = (plugins: PluginOption[]): PluginOption[] =>
  plugins.map((p): PluginOption => {
    if (Array.isArray(p)) {
      return withoutTanstack(p);
    }
    const tanstack =
      typeof p === "object" && p !== null && "name" in p && p.name.startsWith("tanstack");
    return tanstack ? false : p;
  });

const mock = (file: string) => fileURLToPath(new URL(`mocks/${file}`, import.meta.url));

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  staticDirs: ["../public"],
  // vite.config.ts をそのまま読むと TanStack Start がサーバーとルート生成を Storybook 内で動かして壊れる
  viteFinal: (vite) => ({
    ...vite,
    plugins: withoutTanstack(vite.plugins ?? []),
    resolve: {
      ...vite.resolve,
      // サーバー関数と react-start は Node 専用の処理を読み込む。sb.mock は dev の依存スキャンに効かないので alias で差し替える
      alias: [
        { find: /^@tanstack\/react-start$/u, replacement: mock("react-start.ts") },
        { find: /^#\/shared\/api$/u, replacement: mock("shared-api.ts") },
      ],
    },
  }),
};

export default config;
