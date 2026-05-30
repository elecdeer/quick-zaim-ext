import { Fragment, useState } from "react";
import { Button, Input } from "@cloudflare/kumo";

interface Item {
  id: string;
  name: string;
  amount: string;
  comment: string;
}

const newItem = (): Item => ({ id: crypto.randomUUID(), name: "", amount: "", comment: "" });

const localDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const cellInput =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function MainScreen() {
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [date, setDate] = useState(localDateString);

  const total = items.reduce((sum, item) => {
    const n = parseInt(item.amount, 10);
    return sum + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);

  const updateItem = (id: string, patch: Partial<Omit<Item, "id">>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const canSubmit =
    items.length > 0 && items.every((item) => parseInt(item.amount, 10) > 0) && date !== "";

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_5rem_5rem_1.5rem] items-center gap-x-1 gap-y-1">
          <span className="text-xs font-semibold text-gray-500">品目名</span>
          <span className="text-right text-xs font-semibold text-gray-500">金額</span>
          <span className="text-xs font-semibold text-gray-500">メモ</span>
          <span />

          {items.map((item) => (
            <Fragment key={item.id}>
              <input
                className={cellInput}
                placeholder="品目名"
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
              />
              <input
                className={`${cellInput} text-right`}
                type="number"
                min={1}
                step={1}
                placeholder="0"
                value={item.amount}
                onChange={(e) => updateItem(item.id, { amount: e.target.value })}
              />
              <input
                className={cellInput}
                placeholder="メモ"
                value={item.comment}
                onChange={(e) => updateItem(item.id, { comment: e.target.value })}
              />
              <button
                className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label="品目を削除"
              >
                ×
              </button>
            </Fragment>
          ))}
        </div>

        <button
          className="self-start text-sm text-blue-600 hover:underline"
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem()])}
        >
          + 品目を追加
        </button>

        <div className="flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-semibold text-gray-700">合計</span>
          <span className="text-lg font-bold text-gray-900">¥{total.toLocaleString("ja-JP")}</span>
        </div>
      </section>

      <Input
        label="日付"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <Button type="submit" variant="primary" disabled={!canSubmit}>
        登録
      </Button>
    </form>
  );
}
