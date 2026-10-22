import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RootLayout } from "../layout/root-layout";

export const Route = createFileRoute("/_shell")({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
});
