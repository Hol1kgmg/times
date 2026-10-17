import { createServerFn } from "@tanstack/react-start";
import { currentAdmin } from "./session.server";

export const getCurrentAdmin = createServerFn({ method: "GET" }).handler(
  async () => (await currentAdmin()) ?? null,
);
