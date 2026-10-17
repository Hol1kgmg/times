import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () =>
  createRouter({
    routeTree,
    scrollRestoration: true,
    // 未設定だと notFound のたびに Router が警告を出す。表示は既定と同じ (e2e が "Not Found" を見る)
    defaultNotFoundComponent: () => <p>Not Found</p>,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
