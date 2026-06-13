import { useMemo, useRef } from "react";
import { Button, Input, InputGroup } from "@cloudflare/kumo";
import { Dialog } from "@base-ui/react/dialog";
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
 *
 * kumo の `Dialog` ラッパーは base-ui の `initialFocus` を露出しないため、
 * 同じスタイリングで base-ui の Dialog 一式を直接使う。
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

  const initialFocusFn = useMemo(
    () => () => {
      switch (initialFocus) {
        case "name":
          return nameRef.current;
        case "memo":
          return memoRef.current;
        case "amount":
          return amountRef.current;
        case "category":
          return categoryRef.current?.querySelector<HTMLElement>("input, [role=combobox]") ?? null;
        default:
          return null;
      }
    },
    [initialFocus],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-kumo-recessed opacity-80 transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          initialFocus={initialFocusFn}
          className="shadow-m ring ring-kumo-line fixed top-1/2 left-1/2 flex w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-hidden rounded-xl bg-kumo-base p-4 text-kumo-default duration-150 data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0 sm:w-auto sm:min-w-72"
        >
          <Dialog.Title className="m-0 text-base leading-6 font-medium">品目を編集</Dialog.Title>
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
            render={
              <Button variant="primary" type="button">
                完了
              </Button>
            }
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
