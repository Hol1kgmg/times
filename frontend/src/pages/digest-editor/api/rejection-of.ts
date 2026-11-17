import type { BackendError } from "#/shared/api/index.server";

export type Rejection =
  | { reason: "digest-already-exists" }
  | { reason: "future-publish" }
  | { reason: "url-already-registered"; duplicateUrls: string[] }
  | { reason: "repost-needs-child"; duplicateUrls: string[] };

export const rejectionOf = (error: BackendError): Rejection | undefined => {
  const p = error.name === "BackendProblemError" ? error.problem : undefined;
  if (p?.type === "/problems/digest-already-exists") {
    return { reason: "digest-already-exists" };
  }
  if (p?.type === "/problems/future-publish") {
    return { reason: "future-publish" };
  }
  if (p?.type === "/problems/url-already-registered") {
    return { reason: "url-already-registered", duplicateUrls: p.duplicateUrls ?? [] };
  }
  if (p?.type === "/problems/repost-needs-child") {
    return { reason: "repost-needs-child", duplicateUrls: p.duplicateUrls ?? [] };
  }
  return undefined;
};
