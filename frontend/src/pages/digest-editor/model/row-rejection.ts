import type { Rejection } from "../api/rejection-of";

// 再掲載に切り替えた URL は直す必要がないので、登録済みの印から外す
export const rowRejectionOf = (rejected: Extract<Rejection, { duplicateUrls: string[] }>) => {
  const converted = new Set(
    rejected.reason === "url-already-registered" ? rejected.repostable.map((r) => r.url) : [],
  );
  return {
    registered: new Set(
      rejected.reason === "url-already-registered"
        ? rejected.duplicateUrls.filter((u) => !converted.has(u))
        : [],
    ),
    converted,
    unavailable: new Set(rejected.reason === "repost-unavailable" ? rejected.duplicateUrls : []),
  };
};
