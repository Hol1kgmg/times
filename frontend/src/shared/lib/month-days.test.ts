import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";
import { monthDays, stepEnabled } from "./month-days";

describe(monthDays, () => {
  it("starts the week on Sunday and covers every day of the month", () => {
    // 2026-10-01 は木曜、2026-11-01 は日曜
    expect(monthDays(2026, 10).lead).toBe(4);
    expect(monthDays(2026, 11).lead).toBe(0);
    expect(monthDays(2028, 2).days.at(-1)?.toString()).toBe("2028-02-29");
  });
});

describe(stepEnabled, () => {
  it("skips registered dates, crossing into the next month", () => {
    const from = Temporal.PlainDate.from("2026-10-30");
    const taken = new Set(["2026-10-31", "2026-11-01"]);
    expect(stepEnabled(from, 1, taken).toString()).toBe("2026-11-02");
  });
});
