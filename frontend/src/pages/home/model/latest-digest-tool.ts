import { useEffect } from "react";
import { z } from "zod";
import type { Digest } from "#/shared/api";
import { defineTool, registerTool } from "#/shared/lib/webmcp";
import { digestMarkdown } from "./digest-markdown";

// adr/frontend/0014
export const useLatestDigestTool = (digest: Digest | null) => {
  useEffect(() => {
    const controller = new AbortController();
    void registerTool(
      defineTool({
        name: "get_latest_digest",
        description:
          "z_times.dev のトップに出ている最新の Digest (1 日分の記事リンク) を、日付とカテゴリごとの Markdown で返す",
        input: z.object({}),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () =>
          digest === null
            ? "まだ記事がありません"
            : `${digest.entryDate}\n\n${digestMarkdown(digest)}`,
      }),
      controller.signal,
    );
    return () => {
      controller.abort();
    };
  }, [digest]);
};
