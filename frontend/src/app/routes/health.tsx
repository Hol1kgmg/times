import { createFileRoute } from "@tanstack/react-router";
import { getHealth, HealthPage } from "#/pages/health";

export const Route = createFileRoute("/health")({
  loader: async () => await getHealth(),
  component: HealthPage,
});
