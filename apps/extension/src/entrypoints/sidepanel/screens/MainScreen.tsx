import { useState } from "react";
import { Button, Input } from "@cloudflare/kumo";

function localDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function MainScreen() {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localDateString);
  const [comment, setComment] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  const canSubmit = amount !== "" && Number(amount) > 0 && date !== "";

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        label="金額"
        type="number"
        min={1}
        step={1}
        placeholder="1000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Input
        label="日付"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <Input
        label="コメント"
        placeholder="メモ（任意）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        登録
      </Button>
    </form>
  );
}
