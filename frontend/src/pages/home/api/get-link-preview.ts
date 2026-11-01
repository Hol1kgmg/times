import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadLinkPreviewCached } from "#/shared/api/index.server";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { digestHasUrl } from "../model/digest-urls";
import { loadLatestDigest } from "./get-latest-digest";

export const getLinkPreview = createServerFn({ method: "GET" })
  .validator(z.url({ protocol: /^https?$/u }).max(2000))
  .handler(async ({ data: url }): Promise<LinkPreview | null> => {
    // 公開エンドポイントなので、任意の URL を受けるとクローラーや踏み台利用で外部 fetch が青天井になる
    if (!digestHasUrl(await loadLatestDigest(), url)) {
      return null;
    }
    return await loadLinkPreviewCached(url);
  });
