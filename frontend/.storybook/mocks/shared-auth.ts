// 公開 API は getCurrentAdmin から *.server と @tanstack/react-start/server を読み込み、TanStack Start を外した Storybook では解決できない
import { fn } from "storybook/test";

export { isSessionExpired, SESSION_EXPIRED } from "#/shared/auth/errors";
export type { AdminUser, AdminViewer, Viewer } from "#/shared/auth/get-current-admin";

export const getCurrentAdmin = fn().mockResolvedValue(null);
export const requireAdminViewer = fn();
