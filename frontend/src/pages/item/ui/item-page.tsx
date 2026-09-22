import { Await, getRouteApi } from "@tanstack/react-router";
import { Suspense } from "react";

const route = getRouteApi("/items/$id");

export const ItemPage = () => {
  const { item, slow } = route.useLoaderData();
  return (
    <main>
      <h1>{item.title}</h1>
      <Suspense fallback={<p>loading detail…</p>}>
        <Await promise={slow}>{(d) => <p>{d}</p>}</Await>
      </Suspense>
    </main>
  );
};
