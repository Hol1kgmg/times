import { z } from "zod";
import { retry, RetryableError } from "./retry.server";
import { candidates, pickTerms } from "./title-candidates";
import { workersAi } from "./workers-ai.server";

const QUESTION = "この語は製品・サービス・技術・ライブラリ・言語・人・組織の名前か";

const answers = z.object({
  answers: z.record(z.string(), z.object({ type: z.literal("noul"), noul: z.number() })),
});

export const extractTerms = async (title: string): Promise<string[] | null> => {
  const ai = await workersAi();
  if (ai === null) {
    return null;
  }
  const cands = candidates(title);
  if (cands.length === 0) {
    return [];
  }
  const questions = Object.fromEntries(
    cands.map((c, i) => [
      `t${i}`,
      { type: "noul", instructions: { question: QUESTION, term: c.text } },
    ]),
  );
  const res = await retry(async () => {
    try {
      return await ai.run("@cf/cloudflare/clef", { model: "clef", state: { title }, questions });
    } catch (error) {
      throw new RetryableError("clef failed", { cause: error });
    }
  });
  const got = answers.parse(res).answers;
  return pickTerms(
    cands,
    cands.map((_, i) => got[`t${i}`]?.noul ?? 0),
  );
};
