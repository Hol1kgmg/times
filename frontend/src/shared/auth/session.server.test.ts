import { isNotFound } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED } from "./errors";
import { requireAdmin } from "./session.server";

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

// middleware の server 関数を直接呼ぶ。next の引数 (context) をそのまま返して検証する
const run = async () => {
  const next = vi.fn<(opts?: { context?: unknown }) => unknown>((opts) => opts?.context);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- テストから呼ぶために引数の型を緩める
  const server = requireAdmin.options.server as unknown as (o: { next: typeof next }) => unknown;
  const result = await server({ next });
  return { next, result };
};

describe("requireAdmin middleware", () => {
  beforeEach(() => {
    cookies.clear();
  });

  it("throws notFound(SESSION_EXPIRED) without the cookie", async () => {
    const err: unknown = await run().catch((error: unknown) => error);
    expect(isNotFound(err)).toBeTruthy();
    expect(isNotFound(err) && err.data).toStrictEqual({ reason: SESSION_EXPIRED });
  });

  it("passes the token to the next context", async () => {
    cookies.set("times_admin", "tok");
    const { next, result } = await run();
    expect(result).toStrictEqual({ sessionToken: "tok" });
    expect(next).toHaveBeenCalledOnce();
  });
});
