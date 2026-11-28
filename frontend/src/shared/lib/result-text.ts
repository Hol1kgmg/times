export const resultText = (items: readonly unknown[] | undefined) => {
  if (items === undefined) {
    return "";
  }
  return items.length === 0 ? "見つからなかったです" : `${items.length} 件見つかりました`;
};
