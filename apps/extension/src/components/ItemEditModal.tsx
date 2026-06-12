import { Button, Dialog, Input } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialComment: string;
  /** モーダル内の編集確定時に呼び出される。 */
  onSubmit: (next: { name: string; comment: string }) => void;
}

/**
 * 品目の名前・メモを編集するためのモーダル。
 * 幅の狭いサイドパネルで折り返し表示する代わりに、ダイアログ内でゆっくり編集できる用途。
 */
export const ItemEditModal = ({
  open,
  onOpenChange,
  initialName,
  initialComment,
  onSubmit,
}: Props) => {
  const [name, setName] = useState(initialName);
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setComment(initialComment);
    }
  }, [open, initialName, initialComment]);

  const handleSave = () => {
    onSubmit({ name, comment });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="flex flex-col gap-4 p-6">
        <Dialog.Title className="text-base font-semibold text-gray-900">品目の編集</Dialog.Title>

        <Input
          label="品目名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="品目名"
        />

        <Input
          label="メモ"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="メモ"
        />

        <div className="flex justify-end gap-2">
          <Dialog.Close
            render={(p) => (
              <Button {...p} type="button" variant="secondary">
                キャンセル
              </Button>
            )}
          />
          <Button type="button" variant="primary" onClick={handleSave}>
            保存
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
};
