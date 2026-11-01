import { problem } from "#/shared/api";

export type Rejection =
  | { reason: "digest-already-exists" }
  | { reason: "url-already-registered"; duplicateUrls: string[] };

// backendFetch は Problem の本文を未検証のまま cause に載せるので、ここで初めて型を付ける
export const rejectionOf = (error: unknown): Rejection | undefined => {
  const p = problem.safeParse(error instanceof Error ? error.cause : undefined);
  if (p.data?.type === "/problems/digest-already-exists") {
    return { reason: "digest-already-exists" };
  }
  if (p.data?.type === "/problems/url-already-registered") {
    return { reason: "url-already-registered", duplicateUrls: p.data.duplicateUrls ?? [] };
  }
  return undefined;
};
