import { Combobox } from "@cloudflare/kumo";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

type GenreItem = {
  categoryId: number;
  categoryName: string;
  genreId: number;
  genreName: string;
};

type GenreGroup = {
  categoryId: number;
  categoryName: string;
  items: GenreItem[];
};

interface Props {
  serverUrl: string;
  value: CategorySelection | null;
  onChange: (value: CategorySelection | null) => void;
  /** Combobox の表示サイズ。省略時は `base`。 */
  size?: "xs" | "sm" | "base" | "lg";
  /** 表示ラベル。null の場合はラベル領域を出さない（インライン用途）。 */
  label?: string | null;
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
 * カテゴリ（大カテゴリでグループ化されたサブカテゴリ）の combobox コンポーネント。
 * paymentモードのカテゴリのみ対象。1つの Combobox 内でカテゴリごとにグループ表示する。
 */
export const CategoryCombobox = ({
  serverUrl,
  value,
  onChange,
  size,
  label = "カテゴリ",
}: Props) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["categories", serverUrl],
    queryFn: () => fetchCategories(serverUrl),
    enabled: !!serverUrl,
  });

  const groups = useMemo<GenreGroup[]>(() => {
    const categories = (data?.categories ?? []).filter((c) => c.mode === "payment");
    return categories.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      items: c.subCategories.map((sc) => ({
        categoryId: c.id,
        categoryName: c.name,
        genreId: sc.id,
        genreName: sc.name,
      })),
    }));
  }, [data]);

  const selectedItem = useMemo<GenreItem | null>(() => {
    if (!value) return null;
    for (const g of groups) {
      const found = g.items.find((i) => i.genreId === value.genreId);
      if (found) return found;
    }
    return null;
  }, [groups, value]);

  const handleChange = (item: GenreItem | null) => {
    if (!item) {
      onChange(null);
      return;
    }
    onChange({ categoryId: item.categoryId, genreId: item.genreId });
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
    <Combobox
      label={label ?? undefined}
      size={size}
      items={groups}
      value={selectedItem}
      onValueChange={(v) => handleChange(v as GenreItem | null)}
      itemToStringLabel={(item: GenreItem) => `${item.categoryName} > ${item.genreName}`}
      isItemEqualToValue={(a: GenreItem, b: GenreItem) => a.genreId === b.genreId}
    >
      <Combobox.TriggerInput
        placeholder="カテゴリを選択"
        clearLabel="クリア"
        showOptionsLabel="選択肢を表示"
        aria-label={label === null ? "カテゴリ" : undefined}
      />
      <Combobox.Content>
        <Combobox.List>
          {(group: GenreGroup) => (
            <Combobox.Group key={group.categoryId} items={group.items}>
              <Combobox.GroupLabel>{group.categoryName}</Combobox.GroupLabel>
              <Combobox.Collection>
                {(item: GenreItem) => (
                  <Combobox.Item key={item.genreId} value={item}>
                    {item.genreName}
                  </Combobox.Item>
                )}
              </Combobox.Collection>
            </Combobox.Group>
          )}
        </Combobox.List>
        <Combobox.Empty>カテゴリが見つかりません</Combobox.Empty>
      </Combobox.Content>
    </Combobox>
  );
};
