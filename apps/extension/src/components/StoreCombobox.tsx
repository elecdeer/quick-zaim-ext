import { StorefrontIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Store = {
  place: string;
  placeUid: string;
  latestDate: string;
  count: number;
};

type StoresResponse = { fetchedAt: string; stores: Store[] };

export type StoreSelection = {
  place: string;
  placeUid: string;
};

interface Props {
  serverUrl: string;
  value: StoreSelection | null;
  onChange: (value: StoreSelection | null) => void;
}

const fetchStores = async (serverUrl: string): Promise<StoresResponse> => {
  const client = createClient(serverUrl);
  const res = await client.api.zaim.stores.$get(
    { query: {} },
    { init: { credentials: "include" } },
  );
  if (!res.ok) throw new Error("店舗の取得に失敗しました");
  return res.json();
};

/**
 * 店舗選択の combobox コンポーネント。
 * 過去の支払い履歴から店舗候補を表示し、一覧から選択する。
 */
export const StoreCombobox = ({ serverUrl, value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stores", serverUrl],
    queryFn: () => fetchStores(serverUrl),
    enabled: !!serverUrl,
  });

  const stores = data?.stores ?? [];
  const selectedStore = stores.find((s) => s.placeUid === value?.placeUid) ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <StorefrontIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <output
          className="block h-8 flex-1 animate-pulse rounded-lg bg-muted"
          aria-label="店舗を読み込み中"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <StorefrontIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-destructive">店舗の取得に失敗しました</p>
      </div>
    );
  }

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
