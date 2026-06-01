import { Combobox } from "@cloudflare/kumo";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "server/client";

type SubCategory = { id: number; name: string };
type Category = {
  id: number;
  name: string;
  mode: "payment" | "income";
  subCategories: SubCategory[];
};
type CategoriesResponse = { fetchedAt: string; categories: Category[] };

export type CategorySelection = {
  categoryId: number;
  genreId: number;
};

interface Props {
  serverUrl: string;
  value: CategorySelection | null;
  onChange: (value: CategorySelection | null) => void;
}

const fetchCategories = async (serverUrl: string): Promise<CategoriesResponse> => {
  const client = createClient(serverUrl);
  const res = await client.api.zaim.categories.$get(
    { query: {} },
    { init: { credentials: "include" } },
  );
  if (!res.ok) throw new Error("カテゴリの取得に失敗しました");
  return res.json();
};

/**
 * カテゴリ（大カテゴリ → サブカテゴリ連動）の combobox コンポーネント。
 * paymentモードのカテゴリのみ表示し、カテゴリ選択時にサブカテゴリが連動して表示される。
 */
export const CategoryCombobox = ({ serverUrl, value, onChange }: Props) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["categories", serverUrl],
    queryFn: () => fetchCategories(serverUrl),
    enabled: !!serverUrl,
  });

  const categories = (data?.categories ?? []).filter((c) => c.mode === "payment");
  const selectedCategory = categories.find((c) => c.id === value?.categoryId) ?? null;
  const subCategories = selectedCategory?.subCategories ?? [];
  const selectedSubCategory = subCategories.find((g) => g.id === value?.genreId) ?? null;

  const handleCategoryChange = (cat: Category | null) => {
    if (!cat) {
      onChange(null);
      return;
    }
    // カテゴリ変更時はサブカテゴリを先頭にリセット
    const firstGenre = cat.subCategories[0];
    onChange({ categoryId: cat.id, genreId: firstGenre?.id ?? 0 });
  };

  /**
   * @param genre - 選択されたサブカテゴリ。null はクリア操作を意味する
   */
  const handleGenreChange = (genre: SubCategory | null) => {
    if (!value) return;
    if (!genre) {
      onChange({ ...value, genreId: 0 });
      return;
    }
    onChange({ ...value, genreId: genre.id });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {/* output element has implicit ARIA role="status" */}
        <output
          className="block h-9 animate-pulse rounded-lg bg-gray-200"
          aria-label="カテゴリを読み込み中"
        />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-red-600">カテゴリの取得に失敗しました</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Combobox
        label="カテゴリ"
        items={categories}
        value={selectedCategory}
        onValueChange={(v) => handleCategoryChange(v as Category | null)}
        itemToStringLabel={(item: Category) => item.name}
        isItemEqualToValue={(a: Category, b: Category) => a.id === b.id}
      >
        <Combobox.TriggerInput
          placeholder="カテゴリを選択"
          clearLabel="クリア"
          showOptionsLabel="選択肢を表示"
        />
        <Combobox.Content>
          <Combobox.List>
            {(item: Category) => (
              <Combobox.Item key={item.id} value={item}>
                {item.name}
              </Combobox.Item>
            )}
          </Combobox.List>
          <Combobox.Empty>カテゴリが見つかりません</Combobox.Empty>
        </Combobox.Content>
      </Combobox>

      {selectedCategory !== null && (
        <Combobox
          label="サブカテゴリ"
          items={subCategories}
          value={selectedSubCategory}
          onValueChange={(v) => handleGenreChange(v as SubCategory | null)}
          itemToStringLabel={(item: SubCategory) => item.name}
          isItemEqualToValue={(a: SubCategory, b: SubCategory) => a.id === b.id}
        >
          <Combobox.TriggerInput
            placeholder="サブカテゴリを選択"
            clearLabel="クリア"
            showOptionsLabel="選択肢を表示"
          />
          <Combobox.Content>
            <Combobox.List>
              {(item: SubCategory) => (
                <Combobox.Item key={item.id} value={item}>
                  {item.name}
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty>サブカテゴリが見つかりません</Combobox.Empty>
          </Combobox.Content>
        </Combobox>
      )}
    </div>
  );
};
