import { NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { CategoryWithGenres } from "@/ledger/masters";
import { categoryValueOf } from "@/web/categoryValue";

/**
 * カテゴリと内訳の選択肢。値は `categoryValueOf` の形にする。内訳は字下げしてカテゴリの下に並べる。
 */
export const CategoryOptions = ({
  label,
  categories,
}: {
  label: string;
  categories: CategoryWithGenres[];
}) => (
  <NativeSelectOptGroup label={label}>
    {categories.map((category) => [
      <NativeSelectOption key={`c${category.id}`} value={categoryValueOf(category.id, null)}>
        {category.name}
      </NativeSelectOption>,
      ...category.genres.map((genre) => (
        <NativeSelectOption key={`g${genre.id}`} value={categoryValueOf(category.id, genre.id)}>
          {`　${genre.name}`}
        </NativeSelectOption>
      )),
    ])}
  </NativeSelectOptGroup>
);
