import type { Meta, StoryObj } from "@storybook/react-vite";
import { Logo } from "./logo";

const meta = { component: Logo } satisfies Meta<typeof Logo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Hero: Story = { args: { variant: "hero" } };
export const Hover: Story = { args: { variant: "hover" } };
