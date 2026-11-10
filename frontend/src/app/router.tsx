import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () =>
  createRouter({
    routeTree,
    scrollRestoration: true,
    // 既定の fuzzy だと、未知の URL はシェルの外、ローダーの notFound はシェルの中と出る場所が割れる
    notFoundMode: "root",
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
