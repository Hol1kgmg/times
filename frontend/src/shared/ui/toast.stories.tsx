import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Button } from "react-aria-components";
import { toast, Toaster } from "./toast";

const Trigger = ({ show, label }: { show: () => void; label: string }) => {
  // キューはモジュールに 1 つなので、前の story の失敗のトーストが残らないように消す
  useEffect(() => {
    show();
    return toast.clear;
  }, [show]);
  return (
    <>
      <Button className="t-body button" onPress={show}>
        {label}
      </Button>
      <Toaster />
    </>
  );
};

const meta = {
  component: Trigger,
} satisfies Meta<typeof Trigger>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    label: "保存",
    show: () => {
      toast.success("保存しました");
    },
  },
};

export const Failure: Story = {
  args: {
    label: "保存",
    show: () => {
      toast.error("保存できませんでした。時間をおいてもう一度試してください");
    },
  },
};

export const Multiple: Story = {
  args: {
    label: "4 件出す",
    show: () => {
      toast.success("保存しました");
      toast.error("登録済みの記事が含まれてます。印の付いた記事を削除してください");
      toast.success("ログアウトしました");
      toast.error("保存できませんでした。時間をおいてもう一度試してください");
    },
  },
};

export const LongText: Story = {
  args: {
    label: "長文",
    show: () => {
      toast.error(
        "子がほかの日にいる記事は外せないので、隠した行に戻しました。確かめてから保存してください。https://example.com/a/very/long/path/that/does/not/break/naturally",
      );
    },
  },
};
