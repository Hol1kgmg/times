import { describe, expect, it } from "vitest";
import { channelsFor } from "./channels";

describe(channelsFor, () => {
  it("offers a viewer who is not logged in only the timeline, as planned", () => {
    expect(channelsFor({})).toStrictEqual([
      expect.objectContaining({ to: "/timeline", status: "planned" }),
    ]);
  });
});
