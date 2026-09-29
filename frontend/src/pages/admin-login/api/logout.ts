import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runLogout } from "./logout.server";

export const logout = createServerFn({ method: "POST" })
  .validator(z.object({ path: z.string() }))
  .handler(async ({ data }) => await runLogout(data.path));
