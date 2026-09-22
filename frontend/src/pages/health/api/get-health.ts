import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ApiResponse } from "#/shared/api";
import { backendFetch } from "#/shared/api";

// openapi.yaml と乖離したら typecheck で落ちる
const health = z.object({ status: z.string() }) satisfies z.ZodType<ApiResponse<"health">>;

// backend の GET /health をサーバー関数経由で叩く。失敗は例外のまま route の errorComponent に任せる
export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  const res = await backendFetch("/health");
  return health.parse(await res.json());
});
