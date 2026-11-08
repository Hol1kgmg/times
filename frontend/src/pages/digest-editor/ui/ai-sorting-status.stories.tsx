import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiSortingStatus } from "./ai-sorting-status";

const meta = {
  component: AiSortingStatus,
} satisfies Meta<typeof AiSortingStatus>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Sorting: Story = { args: { active: true } };
// 見えないが場所は取っている
export const Idle: Story = { args: { active: false } };
