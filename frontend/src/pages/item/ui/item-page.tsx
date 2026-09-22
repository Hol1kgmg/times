import { Await, getRouteApi } from "@tanstack/react-router";
import { Suspense } from "react";
import styles from "./item-page.module.css";

const route = getRouteApi("/items/$id");

export const ItemPage = () => {
  const { item, slow } = route.useLoaderData();
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{item.title}</h1>
      <Suspense fallback={<p className={styles.loading}>loading detail…</p>}>
        <Await promise={slow}>{(d) => <p className={styles.body}>{d}</p>}</Await>
      </Suspense>
    </div>
  );
};
