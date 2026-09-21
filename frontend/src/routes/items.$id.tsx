import { Await, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { getItem, getSlowDetail } from "#/server/items";

// ssr: 'data-only' = loader はサーバーで走るが HTML はクライアントで描画。
// 遅い Promise は await せず返し、<Await> でストリーミングする。
export const Route = createFileRoute("/items/$id")({
  ssr: "data-only",
  loader: async ({ params }) => ({
    item: await getItem({ data: params }),
    slow: getSlowDetail({ data: params }),
  }),
  component: Item,
});

function Item() {
  const { item, slow } = Route.useLoaderData();
  return (
    <main>
      <h1>{item.title}</h1>
      <Suspense fallback={<p>loading detail…</p>}>
        <Await promise={slow}>{(d) => <p>{d}</p>}</Await>
      </Suspense>
    </main>
  );
}
