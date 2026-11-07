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

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  staticDirs: ["../public"],
  // vite.config.ts をそのまま読むと TanStack Start がサーバーとルート生成を Storybook 内で動かして壊れる
  viteFinal: (vite) => ({ ...vite, plugins: withoutTanstack(vite.plugins ?? []) }),
};

export default config;
