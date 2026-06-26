import * as v from "valibot";

export const CategoriesQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

export type SubCategory = { id: number; name: string };

export type CategoryWithSubCategories = {
  id: number;
  name: string;
  mode: "payment" | "income";
  subCategories: SubCategory[];
};

export type CategoriesResponse = {
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: string;
  categories: CategoryWithSubCategories[];
};
