import { z } from "zod";
import { category } from "./schemas";
import type { Category } from "./schemas";
import { workersAi } from "./workers-ai.server";

const choiceAnswer = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});

export const categoryFromAnswer = (answer: z.infer<typeof choiceAnswer>): Category | null => {
  const parsed = category.safeParse(answer.choice);
  return parsed.success && (answer.probabilities[answer.choice] ?? 0) >= 0.5 ? parsed.data : null;
};

const criteria = {
  セキュリティ:
    "脆弱性、攻撃・インシデント、セキュリティリリースの告知、認証局、漏洩したキーの対策",
  IT系: "開発技術の記事: 言語、フレームワーク、HTML・CSS などの Web 標準、インフラ、既知のツールの更新やリリース、開発の進め方、技術カンファレンスの登壇",
  UI系: "デザインの視点の記事: UI・UX の考え方、見た目や操作感の判断、デザイナー向けの解説、アイコンやフォントの素材",
  AI系: "AI・LLM・エージェントが主題の記事。AI を使った開発の進め方も含み、IT系より優先する",
  "面白そうなツール・サービス":
    "新しいツール・ライブラリ・アプリ・Web サービスそのものの紹介 (GitHub リポジトリ、製品ページ、MCP、Agent Skill)。AI のツールもここ",
  その他: "開発技術ではない話: 組織やチームの運営、キャリア、登壇や執筆の工夫、ゲーム、ガジェット",
} satisfies Record<Category, string>;

const answers = z.object({ answers: z.object({ category: choiceAnswer }) });

export const suggestCategoryWithAi = async (article: {
  url: string;
  title: string;
}): Promise<Category | null> => {
  const ai = await workersAi();
  if (ai === null) {
    return null;
  }
  const res = await ai.run("@cf/cloudflare/clef", {
    model: "clef",
    state: article,
    questions: {
      category: {
        type: "choice",
        instructions: "この記事はどのカテゴリに入るか",
        criteria,
      },
    },
  });
  return categoryFromAnswer(answers.parse(res).answers.category);
};
