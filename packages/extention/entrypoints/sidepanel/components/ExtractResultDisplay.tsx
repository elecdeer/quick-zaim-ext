import {
	Button,
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
	Disclosure,
	DisclosureButton,
	DisclosurePanel,
	Field,
	Input,
	Label,
} from "@headlessui/react";
import type { Receipt, ZaimPlace } from "@repo/workers/client";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Trash2, X } from "lucide-react";
import { type FC, useState } from "react";

import { apiClient } from "../lib/api";
import { ItemNameEditModal } from "./ItemNameEditModal";

interface ExtractResultDisplayProps {
	result: Receipt;
	onClear: () => void;
	onUpdate?: (updatedResult: Receipt) => void;
}

export const ExtractResultDisplay: FC<ExtractResultDisplayProps> = ({
	result,
	onClear,
	onUpdate,
}) => {
	const [editableResult, setEditableResult] = useState<Receipt>(result);
	const [editingItem, setEditingItem] = useState<Receipt["items"][0] | null>(
		null,
	);
	const [editingIndex, setEditingIndex] = useState<number>(-1);
	const [shopNameQuery, setShopNameQuery] = useState("");

	// 店舗候補取得
	const placesQuery = useQuery({
		queryKey: ["places"],
		queryFn: async () => {
			const res = await apiClient.places.$get();
			if (res.ok) {
				const data = await res.json();
				if ("places" in data) {
					return data.places;
				}
				throw new Error("Invalid response format");
			}
			throw new Error(res.statusText);
		},
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	const places = placesQuery.data || [];

	// 店舗名のフィルタリング
	const filteredPlaces =
		shopNameQuery === ""
			? places
			: places.filter((place) =>
					place.name.toLowerCase().includes(shopNameQuery.toLowerCase()),
				);

	// 選択された店舗名を取得
	const selectedPlace = places.find(
		(place) => place.name === editableResult.shopName,
	);

	// 基本情報の更新
	const updateBasicInfo = (
		field: keyof Omit<Receipt, "items">,
		value: string | number,
	) => {
		const updated = { ...editableResult, [field]: value };
		setEditableResult(updated);
		if (onUpdate) {
			onUpdate(updated);
		}
	};

	// 商品項目の更新
	const updateItem = (
		index: number,
		field: keyof Receipt["items"][0],
		value: string | number,
	) => {
		const updatedItems = [...editableResult.items];
		updatedItems[index] = { ...updatedItems[index], [field]: value };
		const updated = { ...editableResult, items: updatedItems };
		setEditableResult(updated);
		if (onUpdate) {
			onUpdate(updated);
		}
	};

	// 商品項目の削除
	const removeItem = (index: number) => {
		const updatedItems = editableResult.items.filter((_, i) => i !== index);
		const updated = { ...editableResult, items: updatedItems };
		setEditableResult(updated);
		if (onUpdate) {
			onUpdate(updated);
		}
	};

	// 商品名編集モーダルを開く
	const openItemEdit = (item: Receipt["items"][0], index: number) => {
		setEditingItem(item);
		setEditingIndex(index);
	};

	// 商品名編集を保存
	const saveItemEdit = (updatedItem: Receipt["items"][0]) => {
		if (editingIndex >= 0) {
			const updatedItems = [...editableResult.items];
			updatedItems[editingIndex] = updatedItem;
			const updated = { ...editableResult, items: updatedItems };
			setEditableResult(updated);
			if (onUpdate) {
				onUpdate(updated);
			}
		}
		setEditingItem(null);
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
					<div className="grid grid-cols-2 gap-3">
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								購入日
							</Label>
							<Input
								type="date"
								value={editableResult.date}
								onChange={(e) => updateBasicInfo("date", e.target.value)}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						</Field>
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								店舗名
							</Label>
							<Combobox
								value={selectedPlace}
								onChange={(place: ZaimPlace | null) => {
									if (place) {
										updateBasicInfo("shopName", place.name);
									}
								}}
							>
								<div className="relative">
									<ComboboxInput
										className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
										displayValue={(place: ZaimPlace | null) =>
											place?.name ?? editableResult.shopName
										}
										onChange={(event) => setShopNameQuery(event.target.value)}
										placeholder="店舗名を選択してください"
									/>
									<ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
										<ChevronDown className="h-4 w-4 text-gray-400" />
									</ComboboxButton>
									<ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
										{filteredPlaces.map((place) => (
											<ComboboxOption
												key={place.uid}
												value={place}
												className="relative cursor-pointer select-none py-2 pr-4 pl-8 text-sm data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
											>
												{({ selected }) => (
													<>
														<span
															className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
														>
															{place.name}
														</span>
														{selected && (
															<span className="absolute inset-y-0 left-0 flex items-center pl-2">
																<Check className="h-4 w-4" />
															</span>
														)}
													</>
												)}
											</ComboboxOption>
										))}
										{filteredPlaces.length === 0 && shopNameQuery !== "" && (
											<div className="px-4 py-2 text-gray-500 text-sm">
												候補が見つかりません
											</div>
										)}
									</ComboboxOptions>
								</div>
							</Combobox>
						</Field>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								支払い方法
							</Label>
							<Input
								type="text"
								value={editableResult.paymentMethodName}
								onChange={(e) =>
									updateBasicInfo("paymentMethodName", e.target.value)
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						</Field>
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								合計金額
							</Label>
							<Input
								type="number"
								value={editableResult.sumPrice}
								onChange={(e) =>
									updateBasicInfo("sumPrice", Number(e.target.value))
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						</Field>
					</div>

					<Disclosure>
						<DisclosureButton className="flex w-full justify-between rounded bg-gray-100 px-3 py-2 text-left font-medium text-gray-900 text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
							<span>商品一覧 ({editableResult.items.length}件)</span>
							<ChevronDown className="h-4 w-4" />
						</DisclosureButton>
						<DisclosurePanel className="mt-2 max-h-64 space-y-2 overflow-y-auto">
							{editableResult.items.map((item, index) => (
								<div
									key={`item-${index}-${item.name}`}
									className="rounded border bg-gray-50 p-2"
								>
									<div className="space-y-2">
										{/* 商品名とカテゴリの行 */}
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<button
													type="button"
													onClick={() => openItemEdit(item, index)}
													className="w-full text-left font-medium text-blue-600 text-sm hover:text-blue-800 hover:underline"
												>
													{item.normalizedName}
												</button>
												<p className="text-gray-600 text-xs">{item.category}</p>
											</div>
											<Button
												onClick={() => removeItem(index)}
												className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-white text-xs hover:bg-red-600"
											>
												<Trash2 className="h-3 w-3" />
											</Button>
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
														updateItem(index, "amount", Number(e.target.value))
													}
													className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-sm focus:border-blue-500 focus:outline-none"
												/>
												<span className="text-gray-600 text-xs">個</span>
											</div>
										</div>
									</div>
								</div>
							))}
						</DisclosurePanel>
					</Disclosure>
				</div>
			</div>

			{editingItem && (
				<ItemNameEditModal
					isOpen={editingItem !== null}
					onClose={() => {
						setEditingItem(null);
						setEditingIndex(-1);
					}}
					item={editingItem}
					onSave={saveItemEdit}
				/>
			)}
		</>
	);
};
