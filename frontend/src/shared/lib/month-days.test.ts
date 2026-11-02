import { describe, expect, it } from "vitest";
import { monthDays } from "./month-days";

describe(monthDays, () => {
  it("starts the week on Sunday and covers every day of the month", () => {
    // 2026-10-01 は木曜、2026-11-01 は日曜
    expect(monthDays(2026, 10).lead).toBe(4);
    expect(monthDays(2026, 11).lead).toBe(0);
    expect(monthDays(2028, 2).days.at(-1)?.toString()).toBe("2028-02-29");
  });
});
