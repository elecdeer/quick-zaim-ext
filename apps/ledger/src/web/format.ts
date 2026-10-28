const yenFormat = new Intl.NumberFormat("ja-JP");

/**
 * 金額を「¥1,234」の形で書く。負の金額は「-¥1,234」にする。
 */
export const formatYen = (amount: number): string =>
  `${amount < 0 ? "-" : ""}¥${yenFormat.format(Math.abs(amount))}`;

/**
 * 全体に対する割合を「12.3%」の形で書く。全体が 0 以下なら空にする。
 */
export const formatPercent = (part: number, whole: number): string =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "";

/**
 * YYYY-MM-DD の日付を「10/28（火）」の形で書く。
 */
export const formatDay = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  const weekday = "日月火水木金土"[parsed.getUTCDay()];
  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()}（${weekday}）`;
};
