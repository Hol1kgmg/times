import { describe, expect, it } from "vitest";
import { resultText } from "./result-text";

describe("検索結果の件数の文", () => {
  it("says nothing before searching and tells the count or that nothing was found after", () => {
    expect(resultText(undefined)).toBe("");
    expect(resultText([])).toBe("見つからなかったです");
    expect(resultText([1, 2])).toBe("2 件見つかりました");
  });
});
