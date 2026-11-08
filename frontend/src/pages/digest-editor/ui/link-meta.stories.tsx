import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkMeta } from "./link-meta";

// DraftCard はサーバー関数を読み込み、TanStack Start を外した Storybook では動かないので、メタ行だけを載せる
const meta = {
  component: LinkMeta,
  args: {
    host: "example.com",
    loading: false,
    untitled: false,
    suggested: false,
    registered: false,
  },
} satisfies Meta<typeof LinkMeta>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Suggested: Story = { args: { suggested: true } };
export const Manual: Story = {};
export const Loading: Story = { args: { loading: true } };
