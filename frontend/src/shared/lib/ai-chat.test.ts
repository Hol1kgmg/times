import { describe, expect, it } from "vitest";
import { aiChatUrl, aiPrompt } from "./ai-chat";

describe("ai-chat", () => {
  it("puts the article title and URL into the request", () => {
    const prompt = aiPrompt({ title: "パスキーの仕組み", url: "https://example.com/passkey" });
    expect(prompt).toContain("タイトル: パスキーの仕組み");
    expect(prompt).toContain("URL: https://example.com/passkey");
  });

  it("passes a request with newlines, & and # to the chat unchanged", () => {
    const prompt = aiPrompt({ title: "A & B #1", url: "https://example.com/?a=1&b=2#top" });
    const q = new URL(aiChatUrl("claude", prompt)).searchParams.get("q");
    expect(q).toBe(prompt);
  });
});
