import { useEffect, useRef } from "react";
import { Button, Dialog, Input, InputGroup } from "@cloudflare/kumo";
import { CategoryCombobox, type CategorySelection } from "./CategoryCombobox.tsx";

export type ItemEditField = "name" | "memo" | "amount" | "category";

interface ItemDraft {
  name: string;
  amount: string;
  comment: string;
  category: CategorySelection | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverUrl: string;
  item: ItemDraft;
  /** モーダルが開いたときにフォーカスを当てる項目 */
  initialFocus: ItemEditField;
  onChange: (patch: Partial<ItemDraft>) => void;
}

/**
 * 品目（品名・メモ・金額・カテゴリ）をまとめて編集するためのモーダル。
 * `initialFocus` で指定した項目に開いた直後フォーカスを当てる。
 */
export const ItemEditDialog = ({
  open,
  onOpenChange,
  serverUrl,
  item,
  initialFocus,
  onChange,
}: Props) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const memoRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const target = (() => {
      switch (initialFocus) {
        case "name":
          return nameRef.current;
        case "memo":
          return memoRef.current;
        case "amount":
          return amountRef.current;
        case "category":
          return categoryRef.current?.querySelector<HTMLElement>("input, [role=combobox]");
        default:
          return null;
      }
    })();
    target?.focus();
  }, [open, initialFocus]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="flex flex-col gap-3 p-4" size="sm">
        <Dialog.Title>品目を編集</Dialog.Title>
        <Input
          ref={nameRef}
          size="sm"
          label="品名"
          placeholder="品名"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Input
          ref={memoRef}
          size="sm"
          label="メモ"
          placeholder="メモ"
          value={item.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">金額</span>
          <InputGroup size="sm" className="isolate">
            <InputGroup.Addon>¥</InputGroup.Addon>
            <InputGroup.Input
              ref={amountRef}
              aria-label="金額"
              className="appearance-none text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              type="number"
              min={1}
              step={1}
              placeholder="0"
              value={item.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
            />
          </InputGroup>
        </div>
        <div ref={categoryRef}>
          <CategoryCombobox
            serverUrl={serverUrl}
            value={item.category}
            onChange={(value) => onChange({ category: value })}
            size="sm"
          />
        </div>
        <Dialog.Close
          render={(p) => (
            <Button variant="primary" {...p}>
              完了
            </Button>
          )}
        />
      </Dialog>
    </Dialog.Root>
  );
};
