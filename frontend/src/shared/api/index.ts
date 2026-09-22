import type { operations } from "./openapi.gen";

export { backendFetch } from "./backend.server";
export { readItems } from "./db.server";
export * from "./schemas";
// backend/api/openapi.yaml から生成 (just be-gen / lefthook)。手で編集しない
export type { components, operations, paths } from "./openapi.gen";

// operationId から 200 レスポンスの JSON 型を取り出す。例: ApiResponse<"getLatestDigest">
export type ApiResponse<Op extends keyof operations> = Extract<
  operations[Op]["responses"][200 & keyof operations[Op]["responses"]],
  { content: { "application/json": unknown } }
>["content"]["application/json"];
