// entryDate は日付だけの ISO で UTC の 0 時として読まれるため、UTC で書式化しないと前日になりうる
const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});
const withYearFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});
// サーバー (UTC) とブラウザで年明けの判定がずれると、SSR とハイドレーションの結果が食い違う
const tokyoYear = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Tokyo" });

export const formatEntryDate = (entryDate: string) =>
  (entryDate.startsWith(tokyoYear.format(new Date())) ? dateFormat : withYearFormat).format(
    new Date(entryDate),
  );

// フィードの題名と OG 画像 (backend の feed.go) は画像を長くキャッシュするので、今年かどうかで形を変えない
export const formatEntryDateWithoutYear = (entryDate: string) =>
  dateFormat.format(new Date(entryDate));
