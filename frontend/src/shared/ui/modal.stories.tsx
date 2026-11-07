import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "react-aria-components";
import { fn } from "storybook/test";
import { ModalDialog } from "./modal";

const meta = {
  component: ModalDialog,
  args: {
    className: "modal",
    labelledBy: "modal-heading",
    onClose: fn<() => void>(),
    children: ({ close }) => (
      <>
        <p className="t-body" id="modal-heading">
          今日の記事は登録済みです。編集しますか？
        </p>
        <Button className="t-body button" onPress={close}>
          閉じる
        </Button>
      </>
    ),
  },
} satisfies Meta<typeof ModalDialog>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
export const CloseOnOutside: StoryObj<typeof meta> = { args: { closeOnOutside: true } };
