import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "#/pages/client";

// ssr: false = サーバーでは何も描画せず、クライアントでのみマウントする
export const Route = createFileRoute("/_shell/client")({
  ssr: false,
  component: ClientPage,
});
