import { createServerFn } from "@tanstack/react-start";
import { requireAdminToken } from "#/shared/auth/index.server";
import { backendFetch, unwrapBackend } from "./backend.server";
import { repostCandidateList } from "./schemas";
import { articleSearchQuery } from "./search-articles";

// 登録したばかりの記事も候補に出るよう、キャッシュを通さない
export const listRepostCandidates = createServerFn({ method: "GET" })
  .validator(articleSearchQuery)
  .handler(async ({ data }) => {
    const res = unwrapBackend(
      await backendFetch(`/articles/repost-candidates?${new URLSearchParams(data)}`, undefined, {
        token: requireAdminToken(),
      }),
    );
    return repostCandidateList.parse(await res.json());
  });
