import type { DigestSummary } from "#/shared/api";

export interface MonthGroup {
  month: number;
  items: DigestSummary[];
}
export interface YearGroup {
  year: number;
  months: MonthGroup[];
}

export const groupByMonth = (items: DigestSummary[]): YearGroup[] => {
  const years: YearGroup[] = [];
  for (const d of items) {
    const year = Number(d.entryDate.slice(0, 4));
    const month = Number(d.entryDate.slice(5, 7));
    let y = years.at(-1);
    if (y?.year !== year) {
      y = { year, months: [] };
      years.push(y);
    }
    let m = y.months.at(-1);
    if (m?.month !== month) {
      m = { month, items: [] };
      y.months.push(m);
    }
    m.items.unshift(d);
  }
  return years;
};
