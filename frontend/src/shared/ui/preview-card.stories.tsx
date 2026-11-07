import type { Meta, StoryObj } from "@storybook/react-vite";
import { PreviewCard } from "./preview-card";

const meta = {
  component: PreviewCard,
  args: {
    url: "https://example.com/passkey",
    title: "パスキーの仕組みをちゃんと理解する",
    className: "",
    preview: Promise.resolve({
      title: "プレビューのタイトル",
      description: "プレビューの説明文",
      image: "/og.png",
    }),
  },
} satisfies Meta<typeof PreviewCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithImage: Story = {};
export const WithoutImage: Story = {
  args: {
    preview: Promise.resolve({ title: null, description: "説明文だけ取れた記事", image: null }),
  },
};
export const ImageFailed: Story = {
  args: {
    preview: Promise.resolve({ title: null, description: null, image: "/missing.png" }),
  },
};
export const NotFetched: Story = { args: { preview: Promise.resolve(null) } };
