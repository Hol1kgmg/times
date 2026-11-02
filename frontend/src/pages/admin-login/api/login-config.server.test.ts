import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { loginConfig } from "./login-config.server";

describe(loginConfig, () => {
  it("is a 404 for any path other than the secret login path", () => {
    vi.stubEnv("ADMIN_LOGIN_PATH", "e2e-secret-login-path");
    vi.stubEnv("GITHUB_CLIENT_ID", "test");
    let err: unknown;
    try {
      loginConfig("not-the-path");
    } catch (error) {
      err = error;
    }
    expect(isNotFound(err)).toBeTruthy();
  });
});
