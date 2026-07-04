import { ChevronsUpDownIcon } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
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
  const [open, setOpen] = useState(false);
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
        <Command
          defaultValue={
            selectedItem ? `${selectedItem.categoryName} ${selectedItem.genreName}` : undefined
          }
        >
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
