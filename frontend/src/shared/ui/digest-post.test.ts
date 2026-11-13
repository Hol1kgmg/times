import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatEntryDate } from "./digest-post";

describe(formatEntryDate, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 日本では既に 2026 年の元日
    vi.setSystemTime(new Date("2025-12-31T16:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("omits the year for a date in the current year in Japan", () => {
    expect(formatEntryDate("2026-01-01")).toBe("1月1日(木)");
  });

  it("shows the year for a date before the current year", () => {
    expect(formatEntryDate("2025-12-31")).toBe("2025年12月31日(水)");
  });
});
