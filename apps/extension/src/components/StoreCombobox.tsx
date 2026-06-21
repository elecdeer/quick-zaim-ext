import { StorefrontIcon } from "@phosphor-icons/react";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { useSuspenseQuery } from "@/lib/query";
import { cn } from "@/lib/utils";
import { storesQuery } from "../queries";

export type StoreSelection = {
  place: string;
  placeUid: string;
};

interface Props {
  serverUrl: string;
  value: StoreSelection | null;
  onChange: (value: StoreSelection | null) => void;
}

/**
 * 店舗選択の combobox コンポーネント。
 * 過去の支払い履歴から店舗候補を表示し、一覧から選択する。
 */
export const StoreCombobox = ({ serverUrl, value, onChange }: Props) => {
  if (!serverUrl) return null;

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center gap-2">
          <StorefrontIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-destructive">店舗の取得に失敗しました</p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center gap-2">
            <StorefrontIcon
              size={20}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <output
              className="block h-8 flex-1 animate-pulse rounded-lg bg-muted"
              aria-label="店舗を読み込み中"
            />
          </div>
        }
      >
        <StoreComboboxContent serverUrl={serverUrl} value={value} onChange={onChange} />
      </Suspense>
    </ErrorBoundary>
  );
};

const StoreComboboxContent = ({
  serverUrl,
  value,
  onChange,
}: { serverUrl: string } & Pick<Props, "value" | "onChange">) => {
  const [open, setOpen] = useState(false);
  const { data } = useSuspenseQuery(storesQuery, serverUrl);

  const stores = data?.stores ?? [];
  const selectedStore = stores.find((s) => s.placeUid === value?.placeUid) ?? null;

  return (
    <div className="flex items-center gap-2">
      <StorefrontIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-label="店舗"
                aria-expanded={open}
                className="min-w-0 flex-1 justify-between font-normal"
              />
            }
          >
            <span className={cn("truncate", !selectedStore && "text-muted-foreground")}>
              {selectedStore?.place ?? value?.place ?? "店舗を選択（任意）"}
            </span>
            <ChevronsUpDownIcon className="ml-2 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="店舗を検索" />
              <CommandList>
                <CommandEmpty>店舗が見つかりません</CommandEmpty>
                <CommandGroup>
                  {stores.map((item) => (
                    <CommandItem
                      key={item.placeUid || item.place}
                      value={item.place}
                      data-checked={item.placeUid === value?.placeUid}
                      onSelect={() => {
                        if (item.placeUid === value?.placeUid) {
                          onChange(null);
                        } else {
                          onChange({ place: item.place, placeUid: item.placeUid });
                        }
                        setOpen(false);
                      }}
                    >
                      {item.place}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="クリア"
            onClick={() => onChange(null)}
          >
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
};
