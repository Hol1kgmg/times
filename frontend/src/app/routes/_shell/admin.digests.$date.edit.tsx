import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { DigestEditPage, getDigest, resolveDigestNewPage } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";

export const Route = createFileRoute("/_shell/admin/digests/$date/edit")({
  beforeLoad: async () => await resolveDigestNewPage(),
  loader: async ({ params }) => {
    if (!z.iso.date().safeParse(params.date).success) {
      throw notFound();
    }
    const [digest, list] = await Promise.all([getDigest({ data: params.date }), listDigests()]);
    return { digest, list };
  },
  component: DigestEditPage,
});
