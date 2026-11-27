import type { Decorator } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo } from "react";

// RouterLink は router の外では描画できず、描画ごとに router を作ると story の中身が作り直されて状態が消える
const RouterFrame = ({ children }: { children: ReactNode }) => {
  const router = useMemo(
    () => createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() }),
    [],
  );
  return <RouterContextProvider router={router}>{children}</RouterContextProvider>;
};

export const withRouter: Decorator = (Story) => (
  <RouterFrame>
    <Story />
  </RouterFrame>
);
