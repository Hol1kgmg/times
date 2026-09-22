import { createFileRoute } from "@tanstack/react-router";
import { getItem, getSlowDetail, ItemPage } from "#/pages/item";

// ssr: 'data-only' = loader はサーバーで走るが HTML はクライアントで描画。
// 遅い Promise は await せず返し、<Await> でストリーミングする。
export const Route = createFileRoute("/items/$id")({
  ssr: "data-only",
  loader: async ({ params }) => ({
    item: await getItem({ data: params }),
    slow: getSlowDetail({ data: params }),
  }),
  component: ItemPage,
});
