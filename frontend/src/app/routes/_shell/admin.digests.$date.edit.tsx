import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { DigestEditPage, getDigest, resolveDigestEditorPage } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";

export const Route = createFileRoute("/_shell/admin/digests/$date/edit")({
  // 保存直後に再掲載になった記事の URL。案内を出すだけなので、外から渡されても害はない
  validateSearch: z.object({ reposted: z.url().array().default([]) }),
  beforeLoad: async () => await resolveDigestEditorPage(),
  // 保存後に同じ画面へ戻ったとき、古い読み込み結果を見せずに読み直す
  loaderDeps: ({ search }) => ({ reposted: search.reposted }),
  loader: async ({ params }) => {
    if (!z.iso.date().safeParse(params.date).success) {
      throw notFound();
    }
    const [digest, list] = await Promise.all([getDigest({ data: params.date }), listDigests()]);
    return { digest, list };
  },
  component: DigestEditPage,
});
