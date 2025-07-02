import { Button, Field, Input, Label } from "@headlessui/react";
import type { Receipt } from "@repo/workers/client";
import { Plus, Trash2, X } from "lucide-react";
import { type FC, useState } from "react";
import type { ReceiptState } from "../hooks/useReceiptState";
import { CategorySelector } from "./CategorySelector";
import { ItemNameEditModal } from "./ItemNameEditModal";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { PlaceSelector } from "./PlaceSelector";

// useReceiptStateの戻り値型を定義
type UseReceiptStateReturn = {
	state: ReceiptState;
	updateBasicInfo: (
		field: keyof Omit<ReceiptState, "items">,
		value: string | number | null,
	) => void;
	updateItem: (
		index: number,
		field: keyof ReceiptState["items"][0],
		value: string | number,
	) => void;
	removeItem: (index: number) => void;
	addItem: () => void;
	updateItemFull: (index: number, item: ReceiptState["items"][0]) => void;
	setExtractResult: (receipt: Receipt) => void;
};

interface ExtractResultDisplayProps {
	receiptState: UseReceiptStateReturn;
	onClear: () => void;
}

export const ExtractResultDisplay: FC<ExtractResultDisplayProps> = ({
	receiptState,
	onClear,
}) => {
	const {
		state,
		updateBasicInfo,
		updateItem,
		removeItem,
		addItem,
		updateItemFull,
	} = receiptState;

	const [editingIndex, setEditingIndex] = useState<number | null>(null);

	// 商品合計金額を計算
	const itemsTotalPrice = state.items.reduce(
		(total: number, item: ReceiptState["items"][0]) =>
			total + item.priceYen * item.amount,
		0,
	);

	// 差額を計算
	const priceDifference = state.sumPrice - itemsTotalPrice;

	// 差額商品を作成（差額が0でない場合のみ）
	const differenceItem: ReceiptState["items"][0] | null =
		priceDifference !== 0
			? {
					name: "",
					normalizedName:
						priceDifference > 0 ? "差額（不足分）" : "差額（超過分）",
					categoryId: "",
					priceYen: priceDifference,
					amount: 1,
				}
			: null;

	// 合計金額を商品合計に調整
	const adjustSumPrice = () => {
		updateBasicInfo("sumPrice", itemsTotalPrice);
	};

	// 商品名編集モーダルを開く
	const openItemEdit = (index: number) => {
		setEditingIndex(index);
	};

	// 商品名編集を保存
	const saveItemEdit = (
		updatedItem: Pick<Receipt["items"][number], "name" | "normalizedName">,
	) => {
		if (editingIndex !== null) {
			updateItemFull(editingIndex, {
				...state.items[editingIndex],
				name: updatedItem.name,
				normalizedName: updatedItem.normalizedName,
			});
		}
		setEditingIndex(-1);
	};

	return (
		<>
			<div className="w-full rounded-lg bg-white p-3 shadow-sm">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-bold text-base text-gray-800">抽出結果</h2>
					<Button
						onClick={onClear}
						className="flex items-center justify-center rounded bg-gray-200 px-2 py-1 text-gray-600 text-xs hover:bg-gray-300"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>

				<div className="space-y-3">
					<Field>
						<Label className="mb-1 block font-medium text-gray-600 text-xs">
							購入日
						</Label>
						<Input
							type="date"
							value={state.date}
							onChange={(e) => updateBasicInfo("date", e.target.value)}
							className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
						/>
					</Field>

					<Field>
						<Label className="mb-1 block font-medium text-gray-600 text-xs">
							店舗名
						</Label>
						<PlaceSelector
							value={state.shopId || ""}
							onChange={(place) => {
								if (place) {
									updateBasicInfo("shopId", place.uid);
								} else {
									updateBasicInfo("shopId", "");
								}
							}}
							placeholder="店舗名を選択してください"
						/>
					</Field>

					<Field>
						<Label className="mb-1 block font-medium text-gray-600 text-xs">
							支払い方法
						</Label>
						<PaymentMethodSelector
							value={state.paymentMethodId}
							onChange={(method) => {
								if (method) {
									updateBasicInfo("paymentMethodId", String(method.id));
								} else {
									updateBasicInfo("paymentMethodId", "");
								}
							}}
							placeholder="支払い方法を選択してください"
						/>
					</Field>

					<Field>
						<Label className="mb-1 block font-medium text-gray-600 text-xs">
							合計金額
						</Label>
						<Input
							type="number"
							value={state.sumPrice}
							onChange={(e) =>
								updateBasicInfo("sumPrice", Number(e.target.value))
							}
							className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
						/>
					</Field>

					<div className="rounded border border-gray-300 bg-white">
						<div className="border-gray-200 border-b bg-gray-50 px-3 py-2">
							<h3 className="font-medium text-gray-900 text-sm">
								商品一覧 ({state.items.length + (differenceItem ? 1 : 0)}件)
							</h3>
						</div>
						<div>
							{state.items.map(
								(item: ReceiptState["items"][0], index: number) => (
									<div
										key={`item-${index}-${item.name}`}
										className="border-gray-200 border-b bg-gray-50 p-2 last:border-b-0"
									>
										<div className="space-y-2">
											{/* 商品名の行 */}
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<button
														type="button"
														onClick={() => openItemEdit(index)}
														className="w-full text-left font-medium text-blue-600 text-sm hover:text-blue-800 hover:underline"
													>
														{item.normalizedName}
													</button>
												</div>
												<Button
													onClick={() => removeItem(index)}
													className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-white text-xs hover:bg-red-600"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>

											{/* カテゴリ選択の行 */}
											<div className="flex items-center gap-1">
												<span className="text-gray-600 text-xs">カテゴリ:</span>
												<CategorySelector
													value={item.categoryId}
													onChange={(categoryId) => {
														updateItem(index, "categoryId", categoryId);
													}}
													placeholder="カテゴリを選択"
												/>
											</div>

											{/* 金額と個数の行 */}
											<div className="flex items-center gap-4">
												<div className="flex items-center gap-1">
													<span className="text-gray-600 text-xs">価格:</span>
													<Input
														type="number"
														value={item.priceYen}
														onChange={(e) =>
															updateItem(
																index,
																"priceYen",
																Number(e.target.value),
															)
														}
														className="w-20 rounded border border-gray-300 px-1 py-0.5 text-right text-sm focus:border-blue-500 focus:outline-none"
													/>
													<span className="text-gray-600 text-xs">円</span>
												</div>
												<div className="flex items-center gap-1">
													<span className="text-gray-600 text-xs">数量:</span>
													<Input
														type="number"
														value={item.amount}
														onChange={(e) =>
															updateItem(
																index,
																"amount",
																Number(e.target.value),
															)
														}
														className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-sm focus:border-blue-500 focus:outline-none"
													/>
													<span className="text-gray-600 text-xs">個</span>
												</div>
											</div>
										</div>
									</div>
								),
							)}
							{/* 差額商品の表示 */}
							{differenceItem && (
								<div className="border-gray-200 border-b bg-gray-100 p-2 last:border-b-0">
									<div className="space-y-2">
										{/* 商品名の行 */}
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<span className="text-left font-medium text-gray-700 text-sm">
														{differenceItem.normalizedName}
													</span>
													<span className="text-gray-500 text-xs">
														自動計算
													</span>
												</div>
											</div>
											<Button
												onClick={adjustSumPrice}
												className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-white text-xs hover:bg-blue-700"
											>
												調整
											</Button>
										</div>

										{/* 金額と個数の行 */}
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-1">
												<span className="text-gray-600 text-xs">価格:</span>
												<span className="w-20 rounded border border-gray-300 bg-gray-200 px-1 py-0.5 text-right text-gray-700 text-sm">
													{differenceItem.priceYen}
												</span>
												<span className="text-gray-600 text-xs">円</span>
											</div>
											<div className="flex items-center gap-1">
												<span className="text-gray-600 text-xs">数量:</span>
												<span className="w-16 rounded border border-gray-300 bg-gray-200 px-1 py-0.5 text-center text-gray-700 text-sm">
													{differenceItem.amount}
												</span>
												<span className="text-gray-600 text-xs">個</span>
											</div>
										</div>
									</div>
								</div>
							)}
							{/* 商品追加ボタン */}
							<div className="border-gray-200 border-b bg-white p-2 last:border-b-0">
								<Button
									onClick={addItem}
									className="flex w-full items-center justify-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
								>
									<Plus className="h-4 w-4" />
									商品を追加
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{editingIndex !== null && (
				<ItemNameEditModal
					isOpen={true}
					onClose={() => {
						setEditingIndex(null);
					}}
					item={receiptState.state.items[editingIndex]}
					onSave={saveItemEdit}
				/>
			)}
		</>
	);
};
