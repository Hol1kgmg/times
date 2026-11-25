import { notFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { SESSION_EXPIRED } from "#/shared/auth";
import { rethrowSessionExpired } from "./rethrow-session-expired";

describe(rethrowSessionExpired, () => {
  it("passes an expired session on instead of treating it as a failed fetch", () => {
    const expired = notFound({ data: { reason: SESSION_EXPIRED } });
    let thrown: unknown;
    try {
      rethrowSessionExpired(expired);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(expired);
  });

  it("lets a not-found that is not an expired session be ignored", () => {
    expect(() => {
      rethrowSessionExpired(notFound());
    }).not.toThrow();
  });
});
