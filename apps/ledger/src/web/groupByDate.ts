/**
 * 日付の順に並んだ要素を、続く同じ日付ごとにまとめる。並び順は変えない。
 */
export const groupByDate = <T extends { date: string }>(
  items: T[],
): { date: string; items: T[] }[] => {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last !== undefined && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
};
