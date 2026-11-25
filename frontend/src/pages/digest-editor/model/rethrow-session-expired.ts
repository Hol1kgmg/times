import { isSessionExpired } from "#/shared/auth";

// 取得・翻訳・推定の失敗は手で補えるので握るが、ログイン切れまで握ると黙ってタイトルなし・未分類で入る (#222)
export const rethrowSessionExpired = (error: unknown) => {
  if (isSessionExpired(error)) {
    throw error;
  }
};
