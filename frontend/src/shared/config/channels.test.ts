import { describe, expect, it } from "vitest";
import { channelsFor } from "./channels";

describe(channelsFor, () => {
  it("offers no destinations to a viewer who is not logged in", () => {
    expect(channelsFor({})).toStrictEqual([]);
  });
});
