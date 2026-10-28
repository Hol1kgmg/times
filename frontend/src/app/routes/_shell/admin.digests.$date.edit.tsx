import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { DigestEditPage, getDigest, resolveDigestNewPage } from "#/pages/digest-new";

export const Route = createFileRoute("/_shell/admin/digests/$date/edit")({
  beforeLoad: async () => await resolveDigestNewPage(),
  loader: async ({ params }) => {
    if (!z.iso.date().safeParse(params.date).success) {
      throw notFound();
    }
    return await getDigest({ data: params.date });
  },
  component: DigestEditPage,
});
