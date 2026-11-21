import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, mocked, screen, userEvent } from "storybook/test";
import { listRepostCandidates, repostCandidateList } from "#/shared/api";
import { emptyBoard } from "../model/board";
import type { RepostCandidate } from "../model/board";
import { RepostAdd } from "./repost-picker";

const candidate = (
  n: number,
  extra: {
    title?: string;
    category?: RepostCandidate["category"];
    firstPublishedOn?: string;
    parent?: { url: string; title: string };
  } = {},
) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  url: `https://example.com/articles/${n}`,
  title: `記事のタイトル ${n}`,
  category: "IT系",
  firstPublishedOn: "2026-10-03",
  ...extra,
});

const onBoard = emptyBoard();
onBoard.IT系 = [
  {
    id: "on-board",
    url: candidate(3).url,
    title: candidate(3).title,
    initial: { url: candidate(3).url, title: candidate(3).title },
    translated: false,
    hot: false,
    suggested: false,
    category: "IT系",
    children: [],
  },
];

const meta = {
  component: RepostAdd,
  args: {
    board: onBoard,
    entryDate: "2026-11-02",
    atLimit: false,
    onPick: fn<(candidate: RepostCandidate) => void>(),
  },
  // モックはストーリーをまたいで残るので、ほかのストーリーの候補を持ち越さない
  beforeEach: () => {
    mocked(listRepostCandidates).mockResolvedValue({ articles: [] });
  },
} satisfies Meta<typeof RepostAdd>;
export default meta;

type Story = StoryObj<typeof meta>;

const search = async () => {
  await userEvent.click(screen.getByRole("button", { name: "過去の記事から追加" }));
  await userEvent.type(await screen.findByRole("searchbox"), "記事{Enter}");
};

export const Closed: Story = {};
export const NoDate: Story = { args: { entryDate: "" } };
export const AtLimit: Story = { args: { atLimit: true } };
export const Found: Story = {
  beforeEach: () => {
    mocked(listRepostCandidates).mockResolvedValue(
      repostCandidateList.parse({
        articles: [
          candidate(1),
          candidate(2, {
            category: "AI系",
            parent: { url: candidate(1).url, title: candidate(1).title },
          }),
          candidate(3),
          candidate(4, { firstPublishedOn: "2026-11-02" }),
          candidate(5, {
            title:
              "とても長いタイトルの記事は一覧の幅に収まらないので、折り返さずに末尾を省略して 1 行に収める",
          }),
        ],
      }),
    );
  },
  play: search,
};
export const NotFound: Story = { play: search };
export const Failed: Story = {
  beforeEach: () => {
    mocked(listRepostCandidates).mockRejectedValue(new Error("network"));
  },
  play: search,
};
