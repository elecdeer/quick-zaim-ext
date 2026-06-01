import { useId } from "react";
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
  /** 店舗名（自由入力または過去履歴から選択） */
  place: string;
  /** 過去履歴から選択した場合は Zaim の place_uid、自由入力の場合は null */
  placeUid: string | null;
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
 * 店舗選択コンポーネント。
 * 過去の支払い履歴から候補を表示しつつ、フリーテキスト入力も可能。
 * 既知の店舗を選択した場合は placeUid を設定し、自由入力は placeUid を null にする。
 */
export const StoreCombobox = ({ serverUrl, value, onChange }: Props) => {
  const listId = useId();

  const { data } = useQuery({
    queryKey: ["stores", serverUrl],
    queryFn: () => fetchStores(serverUrl),
    enabled: !!serverUrl,
  });

  const stores = data?.stores ?? [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === "") {
      onChange(null);
      return;
    }
    const matched = stores.find((s) => s.place === inputValue);
    onChange({ place: inputValue, placeUid: matched?.placeUid ?? null });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="block text-sm font-medium text-gray-900" aria-hidden="true">
        店舗
      </span>
      <input
        aria-label="店舗"
        list={listId}
        value={value?.place ?? ""}
        onChange={handleChange}
        placeholder="店舗名（任意）"
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <datalist id={listId}>
        {stores.map((store) => (
          <option key={store.placeUid || store.place} value={store.place} />
        ))}
      </datalist>
    </div>
  );
};
