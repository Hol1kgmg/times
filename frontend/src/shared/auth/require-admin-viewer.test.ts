import { describe, expect, it } from "vitest";
import { requireAdminViewer } from "./require-admin-viewer";

describe(requireAdminViewer, () => {
  it("shows an admin page as missing to a visitor without an admin session", () => {
    expect(() => {
      requireAdminViewer({});
    }).toThrow(expect.objectContaining({ isNotFound: true }));
  });
});
