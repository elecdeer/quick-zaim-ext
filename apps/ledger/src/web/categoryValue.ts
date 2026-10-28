/**
 * カテゴリと内訳を、選択肢の値にする。カテゴリだけなら `c:カテゴリID`、内訳なら `g:カテゴリID:内訳ID`、なければ空文字。
 */
export const categoryValueOf = (categoryId: number | null, genreId: number | null): string => {
  if (genreId !== null) return `g:${categoryId ?? ""}:${genreId}`;
  if (categoryId !== null) return `c:${categoryId}`;
  return "";
};

/**
 * 選択肢の値を、カテゴリと内訳の ID に戻す。
 */
export const parseCategoryValue = (
  value: string,
): { categoryId: number | null; genreId: number | null } => {
  const [kind, first, second] = value.split(":");
  if (kind === "c" && first) return { categoryId: Number(first), genreId: null };
  if (kind === "g" && second) {
    return { categoryId: first ? Number(first) : null, genreId: Number(second) };
  }
  return { categoryId: null, genreId: null };
};
