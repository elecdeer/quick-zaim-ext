import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "server/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  /** ボタンのサイズ。省略時は `default`。 */
  size?: "xs" | "sm" | "default" | "lg";
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
 * 選択中の CategorySelection を「大カテゴリ > サブカテゴリ」形式の文字列で返す。
 * カテゴリ未取得時や該当しない値の場合は null を返す。
 */
export const useCategoryDisplayName = (
  serverUrl: string,
  value: CategorySelection | null,
): string | null => {
  const { data } = useQuery({
    queryKey: ["categories", serverUrl],
    queryFn: () => fetchCategories(serverUrl),
    enabled: !!serverUrl,
  });

  if (!value) return null;
  const category = data?.categories.find((c) => c.id === value.categoryId);
  const genre = category?.subCategories.find((sc) => sc.id === value.genreId);
  if (!category || !genre) return null;
  return `${category.name} > ${genre.name}`;
};

/**
 * カテゴリ（大カテゴリでグループ化されたサブカテゴリ）の combobox コンポーネント。
 * paymentモードのカテゴリのみ対象。1つの Popover 内でカテゴリごとにグループ表示する。
 */
export const CategoryCombobox = ({
  serverUrl,
  value,
  onChange,
  size = "default",
  label = "カテゴリ",
}: Props) => {
  const [open, setOpen] = useState(false);
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {/* output element has implicit ARIA role="status" */}
        <output
          className="block h-8 animate-pulse rounded-lg bg-muted"
          aria-label="カテゴリを読み込み中"
        />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive">カテゴリの取得に失敗しました</p>;
  }

  const triggerLabel = selectedItem
    ? `${selectedItem.categoryName} > ${selectedItem.genreName}`
    : "カテゴリを選択";

  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            role="combobox"
            aria-label="カテゴリ"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn("truncate", !selectedItem && "text-muted-foreground")}>
          {triggerLabel}
        </span>
        <ChevronsUpDownIcon className="ml-2 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="カテゴリを検索" />
          <CommandList>
            <CommandEmpty>カテゴリが見つかりません</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.categoryId} heading={group.categoryName}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.genreId}
                    value={`${item.categoryName} ${item.genreName}`}
                    data-checked={item.genreId === value?.genreId}
                    onSelect={() => {
                      onChange({ categoryId: item.categoryId, genreId: item.genreId });
                      setOpen(false);
                    }}
                  >
                    {item.genreName}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (label === null) {
    return trigger;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {trigger}
    </div>
  );
};
