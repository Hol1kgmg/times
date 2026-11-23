import { createFileRoute } from "@tanstack/react-router";
import { PAGE_SIZE, resolveTimelinePage, TimelinePage } from "#/pages/digest-timeline";
import { listPublishedDigests } from "#/shared/api";
import { SITE_NAME } from "#/shared/config/site";

export const Route = createFileRoute("/_shell/timeline")({
  beforeLoad: async () => await resolveTimelinePage(),
  // 一覧は loader の値で 1 回だけ作るので、残った値で開くと公開の切り替えが出ない
  gcTime: 0,
  loader: async () => await listPublishedDigests({ data: { limit: PAGE_SIZE } }),
  head: () => ({ meta: [{ title: `#timeline | ${SITE_NAME}` }] }),
  component: TimelinePage,
});
