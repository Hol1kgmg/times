import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatEntryDate, formatFirstPublished } from "./entry-date";

describe("entry date formats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 日本では既に 2026 年の元日
    vi.setSystemTime(new Date("2025-12-31T16:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe(formatFirstPublished, () => {
    it("omits the year for a first publication in the current year", () => {
      expect(formatFirstPublished("2026-10-03")).toBe("再掲載 · 10月3日(土)に初掲載");
    });

    it("shows the year for a first publication before the current year", () => {
      expect(formatFirstPublished("2025-10-03")).toBe("再掲載 · 2025年10月3日(金)に初掲載");
    });
  });

  describe(formatEntryDate, () => {
    it("omits the year for a date in the current year in Japan", () => {
      expect(formatEntryDate("2026-01-01")).toBe("1月1日(木)");
    });

    it("shows the year for a date before the current year", () => {
      expect(formatEntryDate("2025-12-31")).toBe("2025年12月31日(水)");
    });
  });
});
