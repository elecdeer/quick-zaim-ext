import { Combobox } from "@cloudflare/kumo";
import { StorefrontIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "server/client";

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
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stores", serverUrl],
    queryFn: () => fetchStores(serverUrl),
    enabled: !!serverUrl,
  });

  const stores = data?.stores ?? [];
  const selectedStore = stores.find((s) => s.placeUid === value?.placeUid) ?? null;

  const handleChange = (store: Store | null) => {
    onChange(store ? { place: store.place, placeUid: store.placeUid } : null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <StorefrontIcon size={20} className="shrink-0 text-gray-500" aria-hidden="true" />
        <output
          className="block h-9 flex-1 animate-pulse rounded-lg bg-gray-200"
          aria-label="店舗を読み込み中"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <StorefrontIcon size={20} className="shrink-0 text-gray-500" aria-hidden="true" />
        <p className="text-sm text-red-600">店舗の取得に失敗しました</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <StorefrontIcon size={20} className="shrink-0 text-gray-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Combobox
          label={null}
          aria-label="店舗"
          items={stores}
          value={selectedStore}
          onValueChange={(v) => handleChange(v as Store | null)}
          itemToStringLabel={(item: Store) => item.place}
          isItemEqualToValue={(a: Store, b: Store) => a.placeUid === b.placeUid}
        >
          <Combobox.TriggerInput
            placeholder="店舗を選択（任意）"
            clearLabel="クリア"
            showOptionsLabel="選択肢を表示"
          />
          <Combobox.Content>
            <Combobox.List>
              {(item: Store) => (
                <Combobox.Item key={item.placeUid || item.place} value={item}>
                  {item.place}
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty>店舗が見つかりません</Combobox.Empty>
          </Combobox.Content>
        </Combobox>
      </div>
    </div>
  );
};
