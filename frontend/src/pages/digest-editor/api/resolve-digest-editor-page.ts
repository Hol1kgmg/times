import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { currentAdmin } from "#/shared/auth/index.server";

// requireAdminPage (createServerFn) を server function 内から呼ぶと本番ビルドで "Server function info not found" になる
export const resolveDigestEditorPage = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentAdmin();
  if (!user) {
    throw notFound();
  }
  return { user };
});
