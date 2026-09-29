import { getRequestUrl } from "@tanstack/react-start/server";

// 要求の origin から組み立てる。GitHub OAuth App に登録した callback URL と一致させる
export const callbackUrl = () =>
  new URL("/auth/github/callback", getRequestUrl().origin).toString();
