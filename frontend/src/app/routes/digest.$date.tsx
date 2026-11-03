import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { checkFeedEntry, DigestSharePage, digestShareHead } from "#/pages/digest-share";

// 通知のリンク先。302 だと SNS のクローラーがトップの og:image を読むので、200 で専用画像を示す (specs/010 research R6)
export const Route = createFileRoute("/digest/$date")({
  loader: async ({ params }) => {
    if (!z.iso.date().safeParse(params.date).success) {
      throw notFound();
    }
    await checkFeedEntry({ data: params.date });
    return { date: params.date };
  },
  head: ({ loaderData }) => (loaderData === undefined ? {} : digestShareHead(loaderData.date)),
  component: DigestSharePage,
});
