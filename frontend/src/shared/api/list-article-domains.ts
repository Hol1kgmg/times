import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminToken } from "#/shared/auth/index.server";
import { backendFetch, unwrapBackend } from "./backend.server";
import { domainList } from "./schemas";

const domainQuery = z.object({
  q: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

// 登録した記事のドメインがすぐ候補に出るよう、キャッシュを通さない
const fetchDomains = async (path: string, { q, limit }: z.infer<typeof domainQuery>) => {
  const params = new URLSearchParams();
  if (q !== undefined) {
    params.set("q", q);
  }
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  const res = unwrapBackend(
    await backendFetch(`${path}?${params}`, undefined, { token: requireAdminToken() }),
  );
  return domainList.parse(await res.json());
};

// ponytail: 一般ユーザーのセッションができたら、管理者に限らないトークンに替える
export const listArticleDomains = createServerFn({ method: "GET" })
  .validator(domainQuery)
  .handler(async ({ data }) => await fetchDomains("/articles/domains", data));

export const listAllArticleDomains = createServerFn({ method: "GET" })
  .validator(domainQuery)
  .handler(async ({ data }) => await fetchDomains("/articles/domains/all", data));
