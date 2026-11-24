import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { DigestEditPage, getDigest } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";

export const Route = createFileRoute("/_shell/_admin/admin/digests/$date/edit")({
  // 盤面は loader の値で 1 回だけ作るので、残った値で開くと保存前の内容から作られ、次の保存で直した分が戻る
  gcTime: 0,
  loader: async ({ params }) => {
    if (!z.iso.date().safeParse(params.date).success) {
      throw notFound();
    }
    const [digest, list] = await Promise.all([getDigest({ data: params.date }), listDigests()]);
    return { digest, list };
  },
  component: DigestEditPage,
});
