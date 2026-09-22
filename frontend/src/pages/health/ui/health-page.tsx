import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/health");

export const HealthPage = () => {
  const { status } = route.useLoaderData();
  return (
    <main>
      <h1>Backend health</h1>
      <p>status: {status}</p>
    </main>
  );
};
