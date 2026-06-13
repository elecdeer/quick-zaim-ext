import { WalletIcon } from "@phosphor-icons/react";
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

type Account = {
  id: number;
  name: string;
  active: number;
  sort: number;
};

type AccountsResponse = { fetchedAt: string; accounts: Account[] };

interface Props {
  serverUrl: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

const fetchAccounts = async (serverUrl: string): Promise<AccountsResponse> => {
  const client = createClient(serverUrl);
  const res = await client.api.zaim.accounts.$get(
    { query: {} },
    { init: { credentials: "include" } },
  );
  if (!res.ok) throw new Error("口座の取得に失敗しました");
  return res.json();
};

/**
 * 口座選択の combobox コンポーネント。
 * アクティブな口座（active === 1）のみ表示し、使用頻度順（sort）で並び替える。
 */
export const AccountCombobox = ({ serverUrl, value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounts", serverUrl],
    queryFn: () => fetchAccounts(serverUrl),
    enabled: !!serverUrl,
  });

  const accounts = (data?.accounts ?? [])
    .filter((a) => a.active === 1)
    .sort((a, b) => a.sort - b.sort);

  const selectedAccount = accounts.find((a) => a.id === value) ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <WalletIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <output
          className="block h-8 flex-1 animate-pulse rounded-lg bg-muted"
          aria-label="口座を読み込み中"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <WalletIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-destructive">口座の取得に失敗しました</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <WalletIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-label="口座"
                aria-expanded={open}
                className="min-w-0 flex-1 justify-between font-normal"
              />
            }
          >
            <span className={cn("truncate", !selectedAccount && "text-muted-foreground")}>
              {selectedAccount?.name ?? "口座を選択（任意）"}
            </span>
            <ChevronsUpDownIcon className="ml-2 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="口座を検索" />
              <CommandList>
                <CommandEmpty>口座が見つかりません</CommandEmpty>
                <CommandGroup>
                  {accounts.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      data-checked={item.id === value}
                      onSelect={() => {
                        onChange(item.id === value ? null : item.id);
                        setOpen(false);
                      }}
                    >
                      {item.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedAccount && (
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
