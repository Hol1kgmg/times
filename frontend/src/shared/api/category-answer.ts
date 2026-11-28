import { z } from "zod";
import { category } from "./schemas";
import type { Category } from "./schemas";

export const choiceAnswer = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});

export const categoryFromAnswer = (answer: z.infer<typeof choiceAnswer>): Category | null => {
  const parsed = category.safeParse(answer.choice);
  return parsed.success && (answer.probabilities[answer.choice] ?? 0) >= 0.5 ? parsed.data : null;
};
