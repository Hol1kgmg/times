import type { Meta, StoryObj } from "@storybook/react-vite";
import { CollapsiblePanel } from "./collapsible-panel";

const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <p key={i} className="t-body">
      記事 {i + 1}
    </p>
  ));

const meta = {
  component: CollapsiblePanel,
  // 高さの上限はトップの .fit が持つので、その下限 320px の枠で包む
  decorators: [
    (Story) => (
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollapsiblePanel>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Overflowing: Story = { args: { children: lines(30) } };
export const Fits: Story = { args: { children: lines(3) } };
