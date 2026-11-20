// Storybook は TanStack Start を外して動かすので、サーバー関数とそれが読む *.server を載せられない
import { fn } from "storybook/test";

export * from "#/shared/api/schemas";

export const listRepostCandidates = fn().mockResolvedValue({ articles: [] });
export const loadAnyLinkPreview = fn().mockResolvedValue(null);
export const translateTitle = fn().mockResolvedValue(null);
