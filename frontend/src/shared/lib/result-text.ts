// 件数と 0 件を同じ <output> に出して読み上げさせる。undefined はまだ探していない
export const resultText = (items: readonly unknown[] | undefined) => {
  if (items === undefined) {
    return "";
  }
  return items.length === 0 ? "見つからなかったです" : `${items.length} 件見つかりました`;
};
