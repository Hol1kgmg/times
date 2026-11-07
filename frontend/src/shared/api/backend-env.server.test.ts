import { describe, expect, it } from "vitest";
import { readBackendEnv } from "./backend-env.server";

describe(readBackendEnv, () => {
  it("stops outside dev when BACKEND_URL is missing", () => {
    expect(() => readBackendEnv({}, false)).toThrow("BACKEND_URL");
  });

  it("falls back to the local backend in dev", () => {
    expect(readBackendEnv({}, true)).toStrictEqual({
      BACKEND_URL: "http://localhost:8080",
      BACKEND_TOKEN: "",
    });
  });
});
