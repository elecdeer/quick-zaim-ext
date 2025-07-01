import {
	Button,
	Dialog,
	DialogPanel,
	DialogTitle,
	Field,
	Label,
	Textarea,
} from "@headlessui/react";
import type { Receipt } from "@repo/workers/client";
import { Save, X } from "lucide-react";
import { type FC, useCallback, useLayoutEffect, useRef, useState } from "react";

interface ItemNameEditModalProps {
	isOpen: boolean;
	onClose: () => void;
	item: Receipt["items"][0];
	onSave: (updatedItem: Receipt["items"][0]) => void;
}

export const ItemNameEditModal: FC<ItemNameEditModalProps> = ({
	isOpen,
	onClose,
	item,
	onSave,
}) => {
	const [editedItem, setEditedItem] = useState(item);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Textareaの高さを自動調整する関数
	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
	}, []);

	// モーダルが開いたときに高さを調整
	useLayoutEffect(() => {
		adjustTextareaHeight();
	}, [adjustTextareaHeight]);

	const handleSave = () => {
		onSave(editedItem);
		onClose();
	};

	return (
		<Dialog open={isOpen} onClose={onClose} className="relative z-50">
			<div className="fixed inset-0 bg-black/25" />
			<div className="fixed inset-0 flex items-center justify-center p-2">
				<DialogPanel className="w-full max-w-sm rounded-lg bg-white p-4">
					<DialogTitle className="mb-3 font-bold text-base text-gray-900">
						商品名編集
					</DialogTitle>

					<div className="space-y-3">
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								商品名
							</Label>
							<Textarea
								ref={textareaRef}
								value={editedItem.normalizedName}
								onChange={(e) => {
									setEditedItem({
										...editedItem,
										normalizedName: e.target.value,
									});
									adjustTextareaHeight();
								}}
								className="min-h-10 w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
								placeholder="商品名を入力してください"
								autoFocus
							/>
						</Field>
						{editedItem.name !== editedItem.normalizedName && (
							<div className="rounded bg-yellow-50 p-2">
								<p className="text-xs text-yellow-700">
									<span className="font-medium">元の名前:</span>{" "}
									{editedItem.name}
								</p>
							</div>
						)}
					</div>

					<div className="mt-4 flex justify-end gap-2">
						<Button
							onClick={onClose}
							className="flex items-center gap-2 rounded bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600"
						>
							<X className="h-4 w-4" />
							キャンセル
						</Button>
						<Button
							onClick={handleSave}
							className="flex items-center gap-2 rounded bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600"
						>
							<Save className="h-4 w-4" />
							保存
						</Button>
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	);
};
