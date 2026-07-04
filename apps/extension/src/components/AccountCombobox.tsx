import { WalletIcon } from "@phosphor-icons/react";
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
import { accountsQuery } from "../queries";

type Account = {
  id: number;
  name: string;
  active: number;
  sort: number;
};

interface Props {
  serverUrl: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * 口座選択の combobox コンポーネント。
 * アクティブな口座（active === 1）のみ表示し、使用頻度順（sort）で並び替える。
 */
export const AccountCombobox = ({ serverUrl, value, onChange }: Props) => {
  if (!serverUrl) return null;

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center gap-2">
          <WalletIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-destructive">口座の取得に失敗しました</p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center gap-2">
            <WalletIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <output
              className="block h-8 flex-1 animate-pulse rounded-lg bg-muted"
              aria-label="口座を読み込み中"
            />
          </div>
        }
      >
        <AccountComboboxContent serverUrl={serverUrl} value={value} onChange={onChange} />
      </Suspense>
    </ErrorBoundary>
  );
};

const AccountComboboxContent = ({
  serverUrl,
  value,
  onChange,
}: { serverUrl: string } & Pick<Props, "value" | "onChange">) => {
  const [open, setOpen] = useState(false);
  const { data } = useSuspenseQuery(accountsQuery, serverUrl);

  const accounts = (data?.accounts ?? [])
    .filter((a: Account) => a.active === 1)
    .sort((a: Account, b: Account) => a.sort - b.sort);

  const selectedAccount = accounts.find((a: Account) => a.id === value) ?? null;

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
            <Command defaultValue={selectedAccount?.name}>
              <CommandInput placeholder="口座を検索" />
              <CommandList>
                <CommandEmpty>口座が見つかりません</CommandEmpty>
                <CommandGroup>
                  {accounts.map((item: Account) => (
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
