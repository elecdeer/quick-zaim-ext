import { ChevronsUpDownIcon } from "lucide-react";
import { Suspense, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { FieldLabel } from "@/components/ui/field";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { useSuspenseQuery } from "@/lib/query";
import { cn } from "@/lib/utils";
import { categoriesQuery } from "../queries";

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
  if (!serverUrl) return null;

  return (
    <ErrorBoundary
      fallback={<p className="text-sm text-destructive">カテゴリの取得に失敗しました</p>}
    >
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            <output
              className="block h-8 animate-pulse rounded-lg bg-muted"
              aria-label="カテゴリを読み込み中"
            />
          </div>
        }
      >
        <CategoryComboboxContent
          serverUrl={serverUrl}
          value={value}
          onChange={onChange}
          size={size}
          label={label}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

const CategoryComboboxContent = ({
  serverUrl,
  value,
  onChange,
  size,
  label,
}: { serverUrl: string } & Pick<Props, "value" | "onChange" | "size" | "label">) => {
  const { data } = useSuspenseQuery(categoriesQuery, serverUrl);

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

  const trigger = (
    <Combobox
      items={groups}
      value={selectedItem}
      onValueChange={(next) => {
        if (!next) return;
        onChange({ categoryId: next.categoryId, genreId: next.genreId });
      }}
      isItemEqualToValue={(item: GenreItem | null, v: GenreItem | null) =>
        item?.genreId === v?.genreId
      }
      itemToStringLabel={(item: GenreItem | null) => item?.genreName ?? ""}
      filter={(itemValue: GenreItem, query: string) =>
        `${itemValue.categoryName} ${itemValue.genreName}`
          .toLowerCase()
          .includes(query.toLowerCase())
      }
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            aria-label={label ?? "カテゴリ"}
            className="w-full justify-between font-normal"
          />
        }
      >
        <ComboboxValue>
          {(v: GenreItem | null) => (
            <span className={cn("truncate", !v && "text-muted-foreground")}>
              {v ? `${v.categoryName} > ${v.genreName}` : "カテゴリを選択"}
            </span>
          )}
        </ComboboxValue>
        <ChevronsUpDownIcon className="ml-2 opacity-50" />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder="カテゴリを検索" />
        <ComboboxEmpty>カテゴリが見つかりません</ComboboxEmpty>
        <ComboboxList>
          {(group: GenreGroup) => (
            <ComboboxGroup key={group.categoryId} items={group.items}>
              <ComboboxGroupLabel>{group.categoryName}</ComboboxGroupLabel>
              <ComboboxCollection>
                {(item: GenreItem) => (
                  <ComboboxItem key={item.genreId} value={item}>
                    {item.genreName}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
