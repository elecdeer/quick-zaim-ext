/**
 * 店舗の combobox の候補。過去の店舗に加え、入力した名前が一覧になければ「追加」の候補を末尾に足す。
 */
export type PlaceOption = { name: string; isNew: boolean };

/**
 * 店舗の名前の一覧と入力中の文字から、combobox の候補を作る。
 * 前後の空白は落として比べ、空のときや一覧と同じ名前のときは「追加」の候補を出さない。
 */
export const placeOptions = (placeNames: string[], query: string): PlaceOption[] => {
  const name = query.trim();
  const existing = placeNames.map((placeName) => ({ name: placeName, isNew: false }));
  return name === "" || placeNames.includes(name) ? existing : [...existing, { name, isNew: true }];
};
