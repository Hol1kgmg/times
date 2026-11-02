import { isNotFound, isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCompleteGitHubLogin } from "./complete-github-login.server";

const cookies = vi.hoisted(() => new Map<string, string>());

vi.mock(import("@tanstack/react-start/server"), () => ({
  getCookie: (name: string) => cookies.get(name),
  setCookie: (name: string, value: string) => {
    cookies.set(name, value);
  },
  deleteCookie: (name: string) => {
    cookies.delete(name);
  },
  getRequestUrl: () => new URL("http://localhost:3001/auth/github/callback"),
}));

const thrownBy = async (data: Parameters<typeof runCompleteGitHubLogin>[0]) =>
  await runCompleteGitHubLogin(data).catch((error: unknown) => error);

describe(runCompleteGitHubLogin, () => {
  beforeEach(() => {
    cookies.clear();
    cookies.set("times_login", "issued");
    vi.stubEnv("ADMIN_LOGIN_PATH", "e2e-secret-login-path");
    vi.stubEnv("GITHUB_CLIENT_ID", "test");
  });

  it("is a 404 when the state differs from the one issued at login", async () => {
    expect(isNotFound(await thrownBy({ code: "admin", state: "wrong" }))).toBeTruthy();
  });

  it("returns to the login page as cancelled when the user cancels on GitHub", async () => {
    const err = await thrownBy({ state: "issued", error: "access_denied" });
    expect(isRedirect(err) && err.options.search).toStrictEqual({ error: "cancelled" });
  });

  it("stores the session token in the cookie and goes home when the backend creates a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<() => Promise<Response>>()
        .mockResolvedValue(Response.json({ token: "tok" }, { status: 201 })),
    );
    const err = await thrownBy({ code: "admin", state: "issued" });
    expect(isRedirect(err) && err.options.to).toBe("/");
    expect(cookies.get("times_admin")).toBe("tok");
  });
});
