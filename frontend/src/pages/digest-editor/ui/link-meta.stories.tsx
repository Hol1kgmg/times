import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkMeta } from "./link-meta";

// DraftCard はサーバー関数を読み込み、TanStack Start を外した Storybook では動かないので、メタ行だけを載せる
const meta = {
  component: LinkMeta,
  args: {
    host: "example.com",
    untitled: false,
    suggested: false,
    registered: false,
    reposted: false,
    needsChild: false,
  },
} satisfies Meta<typeof LinkMeta>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Suggested: Story = { args: { suggested: true } };
export const Manual: Story = {};
export const Registered: Story = { args: { registered: true } };
export const Reposted: Story = { args: { firstPublishedOn: "2026-10-03" } };
export const RepostNotice: Story = { args: { firstPublishedOn: "2026-10-03", reposted: true } };
export const RepostNeedsChild: Story = { args: { needsChild: true } };
