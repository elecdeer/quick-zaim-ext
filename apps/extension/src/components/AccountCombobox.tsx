import { Combobox } from "@cloudflare/kumo";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "server/client";

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
  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounts", serverUrl],
    queryFn: () => fetchAccounts(serverUrl),
    enabled: !!serverUrl,
  });

  const accounts = (data?.accounts ?? [])
    .filter((a) => a.active === 1)
    .sort((a, b) => a.sort - b.sort);

  const selectedAccount = accounts.find((a) => a.id === value) ?? null;

  const handleChange = (account: Account | null) => {
    onChange(account?.id ?? null);
  };

  if (isLoading) {
    return (
      <output
        className="block h-9 animate-pulse rounded-lg bg-gray-200"
        aria-label="口座を読み込み中"
      />
    );
  }

  if (isError) {
    return <p className="text-sm text-red-600">口座の取得に失敗しました</p>;
  }

  return (
    <Combobox
      label="口座"
      items={accounts}
      value={selectedAccount}
      onValueChange={(v) => handleChange(v as Account | null)}
      itemToStringLabel={(item: Account) => item.name}
      isItemEqualToValue={(a: Account, b: Account) => a.id === b.id}
    >
      <Combobox.TriggerInput
        placeholder="口座を選択（任意）"
        clearLabel="クリア"
        showOptionsLabel="選択肢を表示"
      />
      <Combobox.Content>
        <Combobox.List>
          {(item: Account) => (
            <Combobox.Item key={item.id} value={item}>
              {item.name}
            </Combobox.Item>
          )}
        </Combobox.List>
        <Combobox.Empty>口座が見つかりません</Combobox.Empty>
      </Combobox.Content>
    </Combobox>
  );
};
