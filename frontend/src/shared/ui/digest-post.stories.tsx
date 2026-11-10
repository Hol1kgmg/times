import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { fn } from "storybook/test";
import { DigestPost } from "./digest-post";

const loadPreview = fn<(url: string) => Promise<LinkPreview | null>>();

const meta = {
  component: DigestPost,
  args: {
    digest: {
      entryDate: "2026-10-20",
      articles: [
        {
          category: "セキュリティ",
          hot: true,
          title: "パスキーの仕組みをちゃんと理解する",
          url: "https://example.com/passkey",
          children: [{ title: "WebAuthn の仕様を読む", url: "https://example.com/webauthn" }],
        },
        {
          category: "UI系",
          hot: false,
          title: "CSS の @starting-style",
          url: "https://example.org/css",
          children: [],
        },
        {
          category: "AI系",
          hot: false,
          title: "エージェントの評価方法",
          url: "https://example.net/agent",
          children: [],
        },
      ],
    },
    loadPreview,
  },
  // Storybook は story ごとにモックをリセットするので、戻り値はリセット後の beforeEach で決める
  beforeEach: () => {
    loadPreview.mockResolvedValue({
      title: "プレビューのタイトル",
      description: "プレビューの説明文",
      image: null,
    });
  },
} satisfies Meta<typeof DigestPost>;
export default meta;

export const Default: StoryObj<typeof meta> = {};

export const WithAskAi: StoryObj<typeof meta> = { args: { ai: { shown: true } } };
