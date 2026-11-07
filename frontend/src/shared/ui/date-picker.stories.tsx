import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DatePickerDialog } from "./date-picker";

const meta = {
  component: DatePickerDialog,
  args: {
    value: "2026-10-20",
    disabled: new Set(["2026-10-18", "2026-10-19"]),
    onPick: fn<(date: string) => void>(),
    onClose: fn<() => void>(),
  },
} satisfies Meta<typeof DatePickerDialog>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
