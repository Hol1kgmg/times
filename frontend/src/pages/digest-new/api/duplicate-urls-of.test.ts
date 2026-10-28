import { describe, expect, it } from "vitest";
import { duplicateUrlsOf } from "./duplicate-urls-of";

const failed = (body: unknown) => new Error("backend 400: POST /digests", { cause: body });

describe(duplicateUrlsOf, () => {
  it("returns the already registered urls so the page can mark those cards", () => {
    const body = {
      type: "/problems/url-already-registered",
      title: "Bad Request",
      status: 400,
      duplicateUrls: ["https://a.example"],
    };
    expect(duplicateUrlsOf(failed(body))).toStrictEqual(["https://a.example"]);
  });

  it("leaves other failures to the generic error message", () => {
    const body = { type: "/problems/validation-failed", title: "Bad Request", status: 400 };
    expect(duplicateUrlsOf(failed(body))).toBeUndefined();
  });
});
