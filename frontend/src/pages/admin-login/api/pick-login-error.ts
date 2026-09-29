export type LoginError = "forbidden" | "cancelled" | "failed";

// POST /auth/sessions の結果をログイン画面の文言に写す。403 だけ「許可されていない」、他はすべて「失敗」
export const pickLoginError = (
  status: number | "network",
): Extract<LoginError, "forbidden" | "failed"> => (status === 403 ? "forbidden" : "failed");
