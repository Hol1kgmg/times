import { problem } from "#/shared/api/schemas";

// backendFetch は Problem の本文を未検証のまま cause に載せるので、ここで初めて型を付ける
export const duplicateUrlsOf = (error: unknown): string[] | undefined => {
  const p = problem.safeParse(error instanceof Error ? error.cause : undefined);
  if (p.success && p.data.type === "/problems/url-already-registered") {
    return p.data.duplicateUrls ?? [];
  }
  return undefined;
};
