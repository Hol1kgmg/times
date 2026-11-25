import { isNotFound } from "@tanstack/react-router";

// notFound({ data: { reason } }) の reason。管理者専用のページ・サーバー関数が
// 期限切れ・失効を判別するときに使う (specs/003 contracts/routes.md)
export const SESSION_EXPIRED = "session-expired" as const;

// reason のない notFound (requireAdminViewer など) はログイン切れではない
export const isSessionExpired = (error: unknown): boolean => {
  if (!isNotFound(error)) {
    return false;
  }
  const data: unknown = error.data;
  return (
    typeof data === "object" && data !== null && "reason" in data && data.reason === SESSION_EXPIRED
  );
};
