import { describe, expect, it } from "vitest";
import { digestSummary } from "#/shared/api";
import { groupByMonth } from "./group-by-month";

const at = (n: number, entryDate: string) =>
  digestSummary.parse({ id: `0b2a2f3e-0000-4000-8000-00000000000${n}`, entryDate });

describe(groupByMonth, () => {
  it("keeps years and months newest first but orders days within a month oldest first", () => {
    const a = at(1, "2026-01-05");
    const b = at(2, "2026-01-02");
    const c = at(3, "2025-12-31");
    expect(groupByMonth([a, b, c])).toStrictEqual([
      { year: 2026, months: [{ month: 1, items: [b, a] }] },
      { year: 2025, months: [{ month: 12, items: [c] }] },
    ]);
  });
});
