import type { Meta, StoryObj } from "@storybook/react-vite";
// 公開 API はサーバー関数を読み込み、TanStack Start を外した Storybook では動かない
import { articleId, digestId } from "#/shared/api/schemas";
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

// AI のアイコンは id のある公開ページの形でだけ渡せるので、id を付ける
let seq = 0;
const id = () => {
  seq += 1;
  return articleId.parse(`00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`);
};

const firstPublishedOn = "2026-10-03";
const repostDigest = {
  id: digestId.parse("00000000-0000-4000-8000-100000000000"),
  entryDate: "2026-11-17",
  status: "published" as const,
  articles: [
    {
      id: id(),
      category: "面白そうなツール・サービス" as const,
      hot: false,
      title: "ビルドツールの紹介",
      url: "https://example.com/build-tool",
      firstPublishedOn,
      children: [
        {
          id: id(),
          title: "ビルドツール v2 のリリースノート",
          url: "https://example.com/build-tool-v2",
        },
        { id: id(), title: "v2 への移行ガイド", url: "https://example.com/build-tool-migrate" },
      ],
    },
    {
      id: id(),
      category: "セキュリティ" as const,
      hot: true,
      title: "パスキーの仕組みをちゃんと理解する",
      url: "https://example.com/passkey",
      firstPublishedOn,
      children: [
        { id: id(), title: "パスキーの新しい仕様の草案", url: "https://example.com/passkey-draft" },
      ],
    },
    {
      id: id(),
      category: "面白そうなツール・サービス" as const,
      hot: false,
      title: "ターミナルの新しいエディタ",
      url: "https://example.org/editor",
      children: [],
    },
  ],
};

export const Repost: StoryObj<typeof meta> = { args: { digest: repostDigest } };

export const RepostWithAskAi: StoryObj<typeof meta> = {
  args: { digest: repostDigest, ai: { shown: true } },
};
