import { DragDropProvider } from "@dnd-kit/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { Draft, Link } from "../model/board";
import { Box } from "./box";
import { DraftCard } from "./draft-card";
import type { CardActions } from "./draft-card";

const link = (url: string, title: string, extra: Partial<Link> = {}): Link => ({
  id: url,
  url,
  title,
  initial: { url, title },
  translated: false,
  hot: false,
  ...extra,
});
const draft = (extra: Partial<Draft> = {}): Draft => ({
  ...link("https://nextjs.org/blog/security", "Next.js Security News | Next.js"),
  suggested: false,
  category: "セキュリティ",
  children: [],
  ...extra,
});
const child = link("https://nextjs.org/blog/next-15", "Next.js 15", { category: "セキュリティ" });

const meta = {
  component: DraftCard,
  decorators: [
    (Story) => (
      <DragDropProvider>
        <Box count={1} id="セキュリティ">
          <Story />
        </Box>
      </DragDropProvider>
    ),
  ],
  args: {
    draft: draft(),
    index: 0,
    box: "セキュリティ",
    actions: {
      atLimit: false,
      registered: new Set(),
      converted: new Set(),
      unavailable: new Set(),
      edit: fn<CardActions["edit"]>(() => null),
      revert: fn<CardActions["revert"]>(),
      toggleHot: fn<CardActions["toggleHot"]>(),
      remove: fn<CardActions["remove"]>(),
      canMakeChild: () => false,
      makeChild: fn<CardActions["makeChild"]>(),
      unmakeChild: fn<CardActions["unmakeChild"]>(),
      moveChild: fn<CardActions["moveChild"]>(),
      unhide: fn<CardActions["unhide"]>(),
    },
  },
} satisfies Meta<typeof DraftCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hot: Story = { args: { draft: draft({ hot: true }) } };
export const WithChildren: Story = { args: { draft: draft({ children: [child] }) } };
export const Repost: Story = {
  args: {
    draft: draft({
      repost: { category: "セキュリティ", firstPublishedOn: "2026-11-10" },
      children: [child],
    }),
  },
};
export const RepostUnpublished: Story = {
  args: {
    draft: draft({ repost: { category: "セキュリティ" }, unpublished: true, children: [child] }),
  },
};
export const Hidden: Story = { args: { draft: draft({ hidden: true }) } };
