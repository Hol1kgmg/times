// 既定の入口は実行環境の Temporal を優先し、Workers が壊れた Temporal を出した障害 (2026-07) を踏む
import { Temporal } from "temporal-polyfill/implementation";

export interface MonthDays {
  lead: number;
  days: Temporal.PlainDate[];
}

export const monthDays = (year: number, month: number): MonthDays => {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  return {
    lead: first.dayOfWeek % 7,
    days: Array.from({ length: first.daysInMonth }, (_, i) => first.add({ days: i })),
  };
};
