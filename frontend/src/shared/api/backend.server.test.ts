import { Result } from "@praha/byethrow";
import { describe, expect, it, vi } from "vitest";
import { adminToken } from "#/shared/auth/admin-token";
import { BackendProblemError } from "./backend-problem-error";
import { backendFetch } from "./backend.server";
import { SessionExpiredError } from "./session-expired-error";

const token = adminToken.parse("t");

const problem = (status: number, type: string, extra?: object) =>
  Response.json(
    { type, title: "x", status, ...extra },
    { status, headers: { "content-type": "application/problem+json" } },
  );

const stubFetch = (res: Response) => {
  const fetch = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>().mockResolvedValue(res);
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe(backendFetch, () => {
  it("fails as an expired session on 401 unauthorized with a token", async () => {
    const fetch = stubFetch(problem(401, "/problems/unauthorized"));
    const result = await backendFetch("/auth/sessions/current", {}, { token });
    expect(Result.unwrapError(result)).toBeInstanceOf(SessionExpiredError);
    expect(new Headers(fetch.mock.calls[0]?.[1].headers).get("authorization")).toBe("Bearer t");
  });

  it("does not treat 401 without a token as an expired session", async () => {
    stubFetch(problem(401, "/problems/unauthorized"));
    const result = await backendFetch("/auth/sessions/current");
    expect(Result.unwrapError(result)).toBeInstanceOf(BackendProblemError);
  });

  it("keeps the validated problem so callers can read extension members", async () => {
    stubFetch(
      problem(400, "/problems/url-already-registered", { duplicateUrls: ["https://a.example"] }),
    );
    const result = await backendFetch("/digests", { method: "POST" }, { token });
    expect(Result.unwrapError(result)).toMatchObject({
      status: 400,
      problem: { duplicateUrls: ["https://a.example"] },
    });
  });
});
