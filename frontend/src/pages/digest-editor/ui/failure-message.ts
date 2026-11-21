import { isNotFound } from "@tanstack/react-router";

export const failureMessage = (error: unknown, verb: string) =>
  isNotFound(error)
    ? `ログインが切れました。別のタブでログインし直してから、もう一度${verb}してください`
    : `${verb}できませんでした。時間をおいてもう一度試してください`;
