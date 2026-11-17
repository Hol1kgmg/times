import type { Problem } from "#/shared/api";
import type { BackendError } from "#/shared/api/index.server";

export type Repostable = NonNullable<Problem["repostable"]>[number];

export type Rejection =
  | { reason: "digest-already-exists" }
  | { reason: "future-publish" }
  | { reason: "url-already-registered"; duplicateUrls: string[]; repostable: Repostable[] }
  | { reason: "repost-unavailable"; duplicateUrls: string[] };

export const rejectionOf = (error: BackendError): Rejection | undefined => {
  const p = error.name === "BackendProblemError" ? error.problem : undefined;
  if (p?.type === "/problems/digest-already-exists") {
    return { reason: "digest-already-exists" };
  }
  if (p?.type === "/problems/future-publish") {
    return { reason: "future-publish" };
  }
  if (p?.type === "/problems/url-already-registered") {
    return {
      reason: "url-already-registered",
      duplicateUrls: p.duplicateUrls ?? [],
      repostable: p.repostable ?? [],
    };
  }
  if (p?.type === "/problems/repost-unavailable") {
    return { reason: "repost-unavailable", duplicateUrls: p.duplicateUrls ?? [] };
  }
  return undefined;
};
