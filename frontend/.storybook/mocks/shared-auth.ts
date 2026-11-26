// 公開 API は getCurrentAdmin から *.server と @tanstack/react-start/server を読み込み、TanStack Start を外した Storybook では解決できない
export { isSessionExpired, SESSION_EXPIRED } from "#/shared/auth/errors";
export type { AdminUser, AdminViewer, Viewer } from "#/shared/auth/get-current-admin";
