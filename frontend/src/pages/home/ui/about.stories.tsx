import type { Meta, StoryObj } from "@storybook/react-vite";
import { About } from "./about";

const meta = { component: About } satisfies Meta<typeof About>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
