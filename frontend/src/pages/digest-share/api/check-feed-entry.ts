import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isInFeed, loadFeedXml } from "#/shared/api/index.server";

// 載っていない日付の連打を backend に届けないよう、キャッシュ済みのフィードで判定する (specs/010 research R7)
export const checkFeedEntry = createServerFn({ method: "GET" })
  .validator(z.iso.date())
  .handler(async ({ data }) => {
    if (!isInFeed(await loadFeedXml(), data)) {
      throw notFound();
    }
  });
