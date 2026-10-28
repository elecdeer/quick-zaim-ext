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
import { placesQuery, type PlacesResponse } from "../queries";

interface Props {
  serverUrl: string;
  /** 選んだ店舗の名前。一覧にない名前（自動入力で読み取った新しい店舗など）も持てる */
  value: string | null;
  onChange: (value: string | null) => void;
  /** ボタンのサイズ。省略時は `default`。 */
  size?: "sm" | "default";
  /** 先頭の店舗アイコンを出すか。行内に並べるときは false にする。 */
  showIcon?: boolean;
}

/**
 * 店舗選択の combobox コンポーネント。
 * 台帳の店舗を最後に使った日の新しい順に表示し、一覧から選択する。
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

type Place = PlacesResponse["places"][number];

const StoreComboboxContent = ({
  serverUrl,
  value,
  onChange,
  size,
  icon,
}: { serverUrl: string; icon: React.ReactNode } & Pick<Props, "value" | "onChange" | "size">) => {
  const { data } = useSuspenseQuery(placesQuery, serverUrl);

  const places = data.places;
  const selectedPlace = places.find((p) => p.name === value) ?? null;

  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Combobox
          items={places}
          value={selectedPlace}
          onValueChange={(next: Place | null) => {
            onChange(next && next.name === value ? null : (next?.name ?? null));
          }}
          isItemEqualToValue={(a: Place | null, b: Place | null) => a?.id === b?.id}
          itemToStringLabel={(p: Place | null) => p?.name ?? ""}
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
              {(v: Place | null) => (
                <span className={cn("truncate", !v && !value && "text-muted-foreground")}>
                  {v?.name ?? value ?? "店舗を選択（任意）"}
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
              {(item: Place) => (
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
