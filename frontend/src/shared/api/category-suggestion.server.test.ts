import { describe, expect, it } from "vitest";
import { categoryFromAnswer } from "./category-suggestion.server";

const answer = (choice: string, p: number) => ({
  type: "choice" as const,
  choice,
  probabilities: { [choice]: p },
  confidence: p,
});

describe(categoryFromAnswer, () => {
  it("returns the category when its probability is at least 0.5", () => {
    expect(categoryFromAnswer(answer("AI系", 0.5))).toBe("AI系");
  });

  it("leaves the article unsorted below 0.5", () => {
    expect(categoryFromAnswer(answer("AI系", 0.49))).toBeNull();
  });

  it("leaves the article unsorted when the answer is outside the fixed categories", () => {
    expect(categoryFromAnswer(answer("料理", 0.9))).toBeNull();
  });
});
