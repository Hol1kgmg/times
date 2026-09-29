import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runLogout } from "./logout.server";

const cookies = vi.hoisted(() => new Map<string, string>());

vi.mock(import("@tanstack/react-start/server"), () => ({
  getCookie: (name: string) => cookies.get(name),
  setCookie: (name: string, value: string) => {
    cookies.set(name, value);
  },
  deleteCookie: (name: string) => {
    cookies.delete(name);
  },
}));

const stubFetch = (status: number) => {
  const fetch = vi
    .fn<(url: URL, init: RequestInit) => Promise<Response>>()
    .mockResolvedValue(
      status === 204
        ? new Response(null, { status })
        : Response.json(
            { type: "/problems/unauthorized", status },
            { status, headers: { "content-type": "application/problem+json" } },
          ),
    );
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const expectRedirectHome = async (p: Promise<never>) => {
  const err: unknown = await p.catch((error: unknown) => error);
  expect(isRedirect(err)).toBeTruthy();
  expect(isRedirect(err) && err.options.to).toBe("/");
};

describe(runLogout, () => {
  beforeEach(() => {
    cookies.clear();
    vi.stubEnv("ADMIN_LOGIN_PATH", "e2e-secret-login-path");
    vi.stubEnv("GITHUB_CLIENT_ID", "test");
  });

  it("redirects to / without calling the backend when there is no cookie", async () => {
    const fetch = stubFetch(204);
    await expectRedirectHome(runLogout("e2e-secret-login-path"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes the backend session and the cookie", async () => {
    cookies.set("times_admin", "tok");
    const fetch = stubFetch(204);
    await expectRedirectHome(runLogout("e2e-secret-login-path"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1].method).toBe("DELETE");
    expect(cookies.has("times_admin")).toBeFalsy();
  });

  it("still redirects when the backend answers 401", async () => {
    cookies.set("times_admin", "stale");
    stubFetch(401);
    await expectRedirectHome(runLogout("e2e-secret-login-path"));
    expect(cookies.has("times_admin")).toBeFalsy();
  });
});
