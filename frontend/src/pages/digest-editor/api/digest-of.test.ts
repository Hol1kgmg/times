import { Result } from "@praha/byethrow";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { BackendProblemError, SessionExpiredError } from "#/shared/api/index.server";
import { SESSION_EXPIRED } from "#/shared/auth";
import { digestOf } from "./digest-of";

const notFoundData = async (p: Promise<unknown>): Promise<unknown> => {
  const err = await p.catch((error: unknown) => error);
  expect(isNotFound(err)).toBeTruthy();
  return isNotFound(err) && err.data;
};

describe(digestOf, () => {
  it("shows the not found page for a date without a digest", async () => {
    const p = digestOf(Result.fail(new BackendProblemError("backend 404", 404, undefined)));
    await expect(notFoundData(p)).resolves.toBeUndefined();
  });

  it("tells the page the session expired instead of the digest being missing", async () => {
    const p = digestOf(Result.fail(new SessionExpiredError("backend 401")));
    await expect(notFoundData(p)).resolves.toStrictEqual({ reason: SESSION_EXPIRED });
  });
});
