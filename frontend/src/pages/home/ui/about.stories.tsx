import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { About } from "./about";

const meta = {
  component: About,
  // FAQ のサイト内リンクは RouterLink で、router の外では描画できない
  decorators: [
    (Story) => (
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({ component: Story }),
          history: createMemoryHistory(),
        })}
      />
    ),
  ],
} satisfies Meta<typeof About>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
