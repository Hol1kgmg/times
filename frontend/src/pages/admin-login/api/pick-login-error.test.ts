import { describe, expect, it } from "vitest";
import { pickLoginError } from "./pick-login-error";

describe(pickLoginError, () => {
  it("maps 403 to forbidden", () => {
    expect(pickLoginError(403)).toBe("forbidden");
  });

  it("maps 502 to failed", () => {
    expect(pickLoginError(502)).toBe("failed");
  });

  it("maps a network failure to failed", () => {
    expect(pickLoginError("network")).toBe("failed");
  });
});
