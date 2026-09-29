import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED } from "#/shared/auth/errors";
import { backendFetch } from "./backend.server";

const problem = (status: number, type: string) =>
  Response.json(
    { type, status },
    { status, headers: { "content-type": "application/problem+json" } },
  );

const stubFetch = (res: Response) => {
  const fetch = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>().mockResolvedValue(res);
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe(backendFetch, () => {
  it("maps 401 unauthorized with a token to notFound(SESSION_EXPIRED)", async () => {
    const fetch = stubFetch(problem(401, "/problems/unauthorized"));
    const err: unknown = await backendFetch("/auth/sessions/current", {}, { token: "t" }).catch(
      (error: unknown) => error,
    );
    expect(isNotFound(err)).toBeTruthy();
    expect(isNotFound(err) && err.data).toStrictEqual({ reason: SESSION_EXPIRED });
    expect(new Headers(fetch.mock.calls[0]?.[1].headers).get("authorization")).toBe("Bearer t");
  });

  it("throws a plain Error on 401 without a token", async () => {
    stubFetch(problem(401, "/problems/unauthorized"));
    await expect(backendFetch("/auth/sessions/current")).rejects.toThrow("backend 401");
  });

  it("throws a plain Error on 403 forbidden", async () => {
    stubFetch(problem(403, "/problems/forbidden"));
    await expect(
      backendFetch("/auth/sessions", { method: "POST" }, { token: "t" }),
    ).rejects.toThrow("backend 403: POST /auth/sessions");
  });
});
