import type { Meta, StoryObj } from "@storybook/react-vite";
// 公開 API はサーバー関数を読み込み、TanStack Start を外した Storybook では動かない
import type { childArticle, visibleArticle } from "#/shared/api/schemas";
import { articleId, digest, digestId } from "#/shared/api/schemas";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { fn } from "storybook/test";
import type { z } from "zod";
import { fixture } from "../../../.storybook/fixture";
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
          repost: false,
          title: "パスキーの仕組みをちゃんと理解する",
          url: "https://example.com/passkey",
          children: [
            {
              hot: true,
              title: "WebAuthn の仕様を読む",
              url: "https://example.com/webauthn",
            },
          ],
        },
        {
          category: "UI系",
          hot: false,
          repost: false,
          title: "CSS の @starting-style",
          url: "https://example.org/css",
          children: [],
        },
        {
          category: "AI系",
          hot: false,
          repost: false,
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

export const WithAskAi: StoryObj<typeof meta> = {
  args: { ai: { shown: true } },
};

// AI のアイコンは id のある公開ページの形でだけ渡せるので、id を付ける
let seq = 0;
const id = () => {
  seq += 1;
  return articleId.parse(`00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`);
};

// 公開ページの取得は元の掲載が公開済みの記事だけを中身ごと返す
type Shown = Omit<
  z.input<typeof visibleArticle>,
  "hidden" | "listed" | "originalStatus" | "children"
> & {
  children: Omit<
    z.input<typeof childArticle>,
    "category" | "repost" | "hidden" | "originalStatus"
  >[];
};
const shown = ({ children, ...a }: Shown): z.input<typeof visibleArticle> => ({
  ...a,
  hidden: false,
  listed: true,
  originalStatus: "published",
  children: children.map((c) => ({
    category: a.category,
    repost: false,
    hidden: false,
    originalStatus: "published",
    ...c,
  })),
});

const repostDigest = fixture(digest, {
  id: digestId.parse("00000000-0000-4000-8000-100000000000"),
  entryDate: "2026-11-17",
  status: "published" as const,
  articles: [
    // 元の掲載の Digest が公開済みでない親は、中身を隠して子の場所だけ残す
    {
      id: id(),
      category: "AI系" as const,
      hot: false,
      repost: true,
      hidden: false,
      listed: false,
      originalStatus: "private" as const,
      concealed: true as const,
      children: [
        {
          id: id(),
          category: "AI系" as const,
          hot: false,
          repost: false,
          hidden: false,
          originalStatus: "published" as const,
          title: "非公開にした記事の続報",
          url: "https://example.com/concealed-next",
        },
      ],
    },
    ...[
      {
        id: id(),
        category: "面白そうなツール・サービス" as const,
        hot: false,
        repost: true,
        firstPublishedOn: "2026-10-03",
        title:
          "ビルドツールの紹介と、設定ファイルを書かずに始めるための最初の一歩を丁寧に解説する長い記事",
        url: "https://example.com/build-tool",
        children: [
          {
            id: id(),
            hot: true,
            title: "ビルドツール v2 のリリースノート",
            url: "https://example.com/build-tool-v2",
          },
          {
            id: id(),
            hot: false,
            title: "v2 への移行ガイド",
            url: "https://example.com/build-tool-migrate",
          },
        ],
      },
      {
        id: id(),
        category: "面白そうなツール・サービス" as const,
        hot: false,
        repost: false,
        title: "ターミナルの新しいエディタ",
        url: "https://example.org/editor",
        children: [],
      },
      {
        id: id(),
        category: "セキュリティ" as const,
        hot: false,
        repost: true,
        firstPublishedOn: "2026-10-03",
        title: "パスキーの仕組みをちゃんと理解する",
        url: "https://example.com/passkey",
        children: [],
      },
      {
        id: id(),
        category: "セキュリティ" as const,
        hot: false,
        // 前の掲載が非公開にしかないので、閲覧者には普通の行で見せる (specs/018 FR-010)
        repost: true,
        title: "前の Digest を非公開にした再掲載",
        url: "https://example.com/withdrawn",
        children: [
          {
            id: id(),
            hot: false,
            title: "その続報",
            url: "https://example.com/withdrawn-next",
          },
        ],
      },
      {
        id: id(),
        category: "セキュリティ" as const,
        hot: false,
        repost: false,
        title: "パスワードマネージャーの選び方",
        url: "https://example.com/password-manager",
        children: [],
      },
    ].map(shown),
  ],
});

export const Repost: StoryObj<typeof meta> = { args: { digest: repostDigest } };

export const RepostWithAskAi: StoryObj<typeof meta> = {
  args: { digest: repostDigest, ai: { shown: true } },
};

// 親が HOT で子が HOT でない形は保存で作らない (specs/018 FR-016)
const hotPatternsDigest = {
  id: digestId.parse("00000000-0000-4000-8000-200000000000"),
  entryDate: "2026-11-17",
  status: "published" as const,
  articles: [
    {
      id: id(),
      category: "IT系" as const,
      hot: true,
      repost: false,
      title: "親も子も HOT (○○)",
      url: "https://example.com/hot-both",
      children: [
        {
          id: id(),
          hot: true,
          title: "HOT の親の子",
          url: "https://example.com/hot-both-child",
        },
      ],
    },
    {
      id: id(),
      category: "IT系" as const,
      hot: false,
      repost: false,
      title: "子だけ HOT (×○)",
      url: "https://example.com/hot-child",
      children: [
        {
          id: id(),
          hot: true,
          title: "HOT の子",
          url: "https://example.com/hot-child-a",
        },
        {
          id: id(),
          hot: false,
          title: "HOT でない子",
          url: "https://example.com/hot-child-b",
        },
      ],
    },
    {
      id: id(),
      category: "IT系" as const,
      hot: false,
      repost: false,
      title: "どちらも HOT でない (××)",
      url: "https://example.com/hot-none",
      children: [
        {
          id: id(),
          hot: false,
          title: "HOT でない子",
          url: "https://example.com/hot-none-child",
        },
      ],
    },
    {
      id: id(),
      category: "IT系" as const,
      hot: false,
      repost: true,
      firstPublishedOn: "2026-10-03",
      title: "再掲載の親 (HOT にできない)",
      url: "https://example.com/hot-repost",
      children: [
        {
          id: id(),
          hot: true,
          title: "HOT の続報",
          url: "https://example.com/hot-repost-child",
        },
      ],
    },
  ],
};

export const HotPatterns: StoryObj<typeof meta> = {
  args: { digest: hotPatternsDigest },
};
