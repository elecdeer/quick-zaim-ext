import { StorefrontIcon } from "@phosphor-icons/react";
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
import { storesQuery } from "../queries";

export type StoreSelection = {
  place: string;
  placeUid: string;
};

interface Props {
  serverUrl: string;
  value: StoreSelection | null;
  onChange: (value: StoreSelection | null) => void;
  /** ボタンのサイズ。省略時は `default`。 */
  size?: "sm" | "default";
  /** 先頭の店舗アイコンを出すか。行内に並べるときは false にする。 */
  showIcon?: boolean;
}

/**
 * 店舗選択の combobox コンポーネント。
 * 過去の支払い履歴から店舗候補を表示し、一覧から選択する。
 */
export const StoreCombobox = ({
  serverUrl,
  value,
  onChange,
  size = "default",
  showIcon = true,
}: Props) => {
  if (!serverUrl) return null;

  const icon = showIcon && (
    <StorefrontIcon size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  );

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm text-destructive">店舗の取得に失敗しました</p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center gap-2">
            {icon}
            <output
              className="block h-8 flex-1 animate-pulse rounded-lg bg-muted"
              aria-label="店舗を読み込み中"
            />
          </div>
        }
      >
        <StoreComboboxContent
          serverUrl={serverUrl}
          value={value}
          onChange={onChange}
          size={size}
          icon={icon}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

type Store = {
  place: string;
  placeUid: string;
};

const StoreComboboxContent = ({
  serverUrl,
  value,
  onChange,
  size,
  icon,
}: { serverUrl: string; icon: React.ReactNode } & Pick<Props, "value" | "onChange" | "size">) => {
  const { data } = useSuspenseQuery(storesQuery, serverUrl);

  const stores = data?.stores ?? [];
  const selectedStore = stores.find((s) => s.placeUid === value?.placeUid) ?? null;

  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Combobox
          items={stores}
          value={selectedStore}
          onValueChange={(next: Store | null) => {
            if (next && next.placeUid === value?.placeUid) {
              onChange(null);
            } else {
              onChange(next ? { place: next.place, placeUid: next.placeUid } : null);
            }
          }}
          isItemEqualToValue={(a: Store | null, b: Store | null) => a?.placeUid === b?.placeUid}
          itemToStringLabel={(s: Store | null) => s?.place ?? ""}
        >
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size={size}
                aria-label="店舗"
                className="min-w-0 flex-1 justify-between font-normal"
              />
            }
          >
            <ComboboxValue>
              {(v: Store | null) => (
                <span className={cn("truncate", !v && "text-muted-foreground")}>
                  {v?.place ?? "店舗を選択（任意）"}
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
            <ComboboxInput placeholder="店舗を検索" />
            <ComboboxEmpty>店舗が見つかりません</ComboboxEmpty>
            <ComboboxList>
              {(item: Store) => (
                <ComboboxItem key={item.placeUid || item.place} value={item}>
                  {item.place}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  );
};
