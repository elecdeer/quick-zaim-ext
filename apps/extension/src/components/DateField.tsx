import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  /** ISO date string `YYYY-MM-DD` */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toPlainDate = (value: string): Temporal.PlainDate | null => {
  if (!ISO_DATE_RE.test(value)) return null;
  try {
    return Temporal.PlainDate.from(value);
  } catch {
    return null;
  }
};

const toJsDate = (value: string): Date | undefined => {
  const pd = toPlainDate(value);
  if (!pd) return undefined;
  return new Date(pd.year, pd.month - 1, pd.day);
};

const fromJsDate = (d: Date): string =>
  new Temporal.PlainDate(d.getFullYear(), d.getMonth() + 1, d.getDate()).toString();

/**
 * 日付入力フィールド。テキスト直接入力（YYYY-MM-DD）と、カレンダーポップアップによる選択を併用する。
 */
export const DateField = ({ value, onChange, required }: Props) => {
  const [open, setOpen] = useState(false);
  const selectedDate = toJsDate(value);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(fromJsDate(date));
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="shrink-0 cursor-pointer rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="カレンダーを開く"
        >
          <CalendarBlankIcon size={20} weight="regular" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
      <Input
        aria-label="日付"
        className="min-w-0 flex-1"
        type="text"
        inputMode="numeric"
        pattern="\d{4}-\d{2}-\d{2}"
        placeholder="YYYY-MM-DD"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
};
