import { createServerFn } from "@tanstack/react-start";
import { requireAdminPage } from "#/shared/auth";

// route の beforeLoad はクライアントでも走るので、.server.ts の requireAdminPage をここで包む
export const resolveDigestNewPage = createServerFn({ method: "GET" }).handler(
  async () => await requireAdminPage(),
);
