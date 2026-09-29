// notFound({ data: { reason } }) の reason。管理者専用のページ・サーバー関数が
// 期限切れ・失効を判別するときに使う (specs/003 contracts/routes.md)
export const SESSION_EXPIRED = "session-expired" as const;
