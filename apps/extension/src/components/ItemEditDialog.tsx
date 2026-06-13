import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
          return categoryRef.current?.querySelector<HTMLElement>("button, [role=combobox]") ?? null;
        default:
          return null;
      }
    },
    [initialFocus],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={initialFocusFn} className="sm:min-w-72">
        <DialogTitle>品目を編集</DialogTitle>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="item-edit-name">品名</FieldLabel>
            <Input
              ref={nameRef}
              id="item-edit-name"
              placeholder="品名"
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-edit-memo">メモ</FieldLabel>
            <Input
              ref={memoRef}
              id="item-edit-memo"
              placeholder="メモ"
              value={item.comment}
              onChange={(e) => onChange({ comment: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-edit-amount">金額</FieldLabel>
            <InputGroup className="isolate">
              <InputGroupAddon>¥</InputGroupAddon>
              <InputGroupInput
                ref={amountRef}
                id="item-edit-amount"
                className="appearance-none text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                type="number"
                min={1}
                step={1}
                placeholder="0"
                value={item.amount}
                onChange={(e) => onChange({ amount: e.target.value })}
              />
            </InputGroup>
          </Field>
          <div ref={categoryRef}>
            <CategoryCombobox
              serverUrl={serverUrl}
              value={item.category}
              onChange={(value) => onChange({ category: value })}
            />
          </div>
          <DialogClose render={<Button type="button">完了</Button>} />
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
};
