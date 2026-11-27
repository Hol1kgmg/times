import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "#storybook/with-router";
import { About } from "./about";

const meta = {
  component: About,
  decorators: [withRouter],
} satisfies Meta<typeof About>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
