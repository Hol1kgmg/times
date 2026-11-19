import { createRouter, stringifySearchWith } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () =>
  createRouter({
    routeTree,
    scrollRestoration: true,
    // 既定の fuzzy だと、未知の URL はシェルの外、ローダーの notFound はシェルの中と出る場所が割れる
    notFoundMode: "root",
    // 既定は値を JSON や数値として読み、19 桁の x.com の ID などの検索語が丸まる。search は文字列しか使わない
    parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
    stringifySearch: stringifySearchWith(JSON.stringify),
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
