import { WalletIcon } from "@phosphor-icons/react";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
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
  const { data } = useSuspenseQuery(accountsQuery, serverUrl);

  const accounts = (data?.accounts ?? [])
    .filter((a: Account) => a.active === 1)
    .sort((a: Account, b: Account) => a.sort - b.sort);

  const selectedAccount = accounts.find((a: Account) => a.id === value) ?? null;

  return (
    <div className="flex items-center gap-2">
      <WalletIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Combobox
          items={accounts}
          value={selectedAccount}
          onValueChange={(next: Account | null) =>
            onChange(next && next.id === value ? null : (next?.id ?? null))
          }
          isItemEqualToValue={(a: Account | null, b: Account | null) => a?.id === b?.id}
          itemToStringLabel={(a: Account | null) => a?.name ?? ""}
        >
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="outline"
                aria-label="口座"
                className="min-w-0 flex-1 justify-between font-normal"
              />
            }
          >
            <ComboboxValue>
              {(v: Account | null) => (
                <span className={cn("truncate", !v && "text-muted-foreground")}>
                  {v?.name ?? "口座を選択（任意）"}
                </span>
              )}
            </ComboboxValue>
            <ChevronsUpDownIcon className="ml-2 opacity-50" />
          </ComboboxTrigger>
          <ComboboxClear
            render={<Button type="button" variant="ghost" size="icon-sm" aria-label="クリア" />}
          >
            <XIcon />
          </ComboboxClear>
          <ComboboxContent>
            <ComboboxInput placeholder="口座を検索" />
            <ComboboxEmpty>口座が見つかりません</ComboboxEmpty>
            <ComboboxList>
              {(item: Account) => (
                <ComboboxItem key={item.id} value={item}>
                  {item.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  );
};
