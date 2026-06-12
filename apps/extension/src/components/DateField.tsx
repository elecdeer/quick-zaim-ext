import { Button, DatePicker, Field, Input, Popover } from "@cloudflare/kumo";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useState } from "react";

interface Props {
  label?: string;
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
export const DateField = ({ label = "日付", value, onChange, required }: Props) => {
  const [open, setOpen] = useState(false);
  const selectedDate = toJsDate(value);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(fromJsDate(date));
    setOpen(false);
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <Input
          aria-label={label}
          className="flex-1"
          type="text"
          inputMode="numeric"
          pattern="\d{4}-\d{2}-\d{2}"
          placeholder="YYYY-MM-DD"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            render={
              <Button type="button" variant="ghost" size="sm" aria-label="カレンダーを開く">
                <CalendarBlankIcon size={18} weight="regular" />
              </Button>
            }
          />
          <Popover.Content align="end" sideOffset={4}>
            <DatePicker
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onChange={handleCalendarSelect}
            />
          </Popover.Content>
        </Popover>
      </div>
    </Field>
  );
};
