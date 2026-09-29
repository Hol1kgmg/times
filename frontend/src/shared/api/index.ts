import type { operations } from "./openapi.gen";

export { backendFetch, backendFetchRaw } from "./backend.server";
export { readItems } from "./db.server";
export * from "./schemas";
// backend/api/openapi.yaml から生成 (just be-gen / lefthook)。手で編集しない
export type { components, operations, paths } from "./openapi.gen";

// operationId からレスポンスの JSON 型を取り出す (既定は 200)。例: ApiResponse<"getLatestDigest">、ApiResponse<"createSession", 201>
export type ApiResponse<Op extends keyof operations, Status extends number = 200> = Extract<
  operations[Op]["responses"][Status & keyof operations[Op]["responses"]],
  { content: { "application/json": unknown } }
>["content"]["application/json"];
