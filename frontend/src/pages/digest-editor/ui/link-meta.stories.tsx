import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkMeta } from "./link-meta";

const meta = {
  component: LinkMeta,
  args: {
    host: "example.com",
    untitled: false,
    suggested: false,
    registered: false,
    repost: false,
    converted: false,
    unavailable: false,
  },
} satisfies Meta<typeof LinkMeta>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Suggested: Story = { args: { suggested: true } };
export const Manual: Story = {};
export const Registered: Story = { args: { registered: true } };
export const Repost: Story = { args: { repost: true, firstPublishedOn: "2026-10-03" } };
export const RepostConverted: Story = {
  args: { repost: true, firstPublishedOn: "2026-10-03", converted: true },
};
export const RepostUnavailable: Story = {
  args: { repost: true, firstPublishedOn: "2026-10-03", unavailable: true },
};
export const RepostUnpublished: Story = { args: { repost: true, unpublished: true } };
export const Hidden: Story = { args: { hidden: true } };
