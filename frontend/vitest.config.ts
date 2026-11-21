import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { cloudflareBuiltins } from "./vite.config";

export default defineConfig({
  resolve: {
    alias: {
      "#": "/src",
    },
  },
  plugins: [viteReact(), cloudflareBuiltins],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/index.{ts,tsx}",
        "src/app/routeTree.gen.ts",
        "src/**/*.d.ts",
      ],
    },
  },
});
