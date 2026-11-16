// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AskAiCombined } from "./ask-ai-combined";
import { AskAiUiSdk } from "./ask-ai-ui-sdk";

// issue #167: TanStack Start の SSR と同じく window のない環境で描けるか
describe("UI SDK の Popover を使う AI のアイコン", () => {
  const props = { title: "記事", url: "https://example.com/" };

  it.each([
    ["UI SDK だけ", <AskAiUiSdk key="a" {...props} />],
    ["併用", <AskAiCombined key="b" racTrigger {...props} />],
  ])("%s: サーバーで閉じたトリガーだけを ARIA 付きで描く", (_, element) => {
    const html = renderToString(element);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("AI に解説");
  });
});
