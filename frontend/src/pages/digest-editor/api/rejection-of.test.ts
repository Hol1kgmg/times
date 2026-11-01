import { describe, expect, it } from "vitest";
import { rejectionOf } from "./rejection-of";

const failed = (type: string, extra?: object) =>
  new Error("backend 400: POST /digests", {
    cause: { type, title: "Bad Request", status: 400, ...extra },
  });

describe(rejectionOf, () => {
  it("returns the already registered urls so the page can mark those cards", () => {
    const err = failed("/problems/url-already-registered", {
      duplicateUrls: ["https://a.example"],
    });
    expect(rejectionOf(err)).toStrictEqual({
      reason: "url-already-registered",
      duplicateUrls: ["https://a.example"],
    });
  });

  it("tells the page that the entry date is already taken", () => {
    expect(rejectionOf(failed("/problems/digest-already-exists"))).toStrictEqual({
      reason: "digest-already-exists",
    });
  });

  it("leaves other failures to the generic error message", () => {
    expect(rejectionOf(failed("/problems/validation-failed"))).toBeUndefined();
  });
});
