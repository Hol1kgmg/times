import type { operations } from "./openapi.gen";

export { fetchAnyLinkPreview } from "./fetch-any-link-preview";
export { getLatestDigest } from "./get-latest-digest";
export { listAllArticleDomains, listArticleDomains } from "./list-article-domains";
export { listDigests } from "./list-digests";
export { listPublishedDigests } from "./list-published-digests";
export { loadAnyLinkPreview } from "./load-any-link-preview";
export { reportArticleOpen, reportPageView } from "./report";
export * from "./schemas";
export { suggestCategory } from "./suggest-category";
export { autoTranslateTitle, translateTitle } from "./translate-title";
// backend/api/openapi.yaml から生成 (just be-gen / lefthook)。手で編集しない
export type { components, operations, paths } from "./openapi.gen";

// operationId からレスポンスの JSON 型を取り出す (既定は 200)。例: ApiResponse<"getLatestDigest">、ApiResponse<"createSession", 201>
export type ApiResponse<Op extends keyof operations, Status extends number = 200> = Extract<
  operations[Op]["responses"][Status & keyof operations[Op]["responses"]],
  { content: { "application/json": unknown } }
>["content"]["application/json"];
