import { createFileRoute } from "@tanstack/react-router";
import { RootLayout } from "../layout/root-layout";

// サイドバー付きのシェル。トップ (/) は入り口ページなので外す
export const Route = createFileRoute("/_shell")({
  component: RootLayout,
});
