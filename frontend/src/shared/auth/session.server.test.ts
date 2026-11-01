import { isNotFound } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED } from "./errors";
import { requireAdminToken } from "./session.server";

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

describe(requireAdminToken, () => {
  beforeEach(() => {
    cookies.clear();
  });

  it("throws notFound(SESSION_EXPIRED) without the cookie", () => {
    let err: unknown;
    try {
      requireAdminToken();
    } catch (error) {
      err = error;
    }
    expect(isNotFound(err)).toBeTruthy();
    expect(isNotFound(err) && err.data).toStrictEqual({ reason: SESSION_EXPIRED });
  });

  it("returns the token from the cookie", () => {
    cookies.set("times_admin", "tok");
    expect(requireAdminToken()).toBe("tok");
  });
});
