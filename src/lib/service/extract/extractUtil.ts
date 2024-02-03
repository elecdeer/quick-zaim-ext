/**
 * ￥1,009のような文字列を数値に変換する
 * @param priceStr
 */
export const parsePriceYen = (priceStr: string): number => {
  const price = priceStr.replace("￥", "").replace(",", "");
  return parseInt(price, 10);
};
