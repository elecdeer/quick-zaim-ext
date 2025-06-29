import {
	Button,
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
	Field,
	Input,
	Label,
} from "@headlessui/react";
import type {
	Receipt,
	ZaimPaymentMethod,
	ZaimPlace,
} from "@repo/workers/client";
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
	const [paymentMethodQuery, setPaymentMethodQuery] = useState("");

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

	// 支払い方法候補取得
	const paymentMethodsQuery = useQuery({
		queryKey: ["payment-methods"],
		queryFn: async () => {
			const res = await apiClient["payment-methods"].$get();
			if (res.ok) {
				const data = await res.json();
				if ("paymentMethods" in data) {
					return data.paymentMethods;
				}
				throw new Error("Invalid response format");
			}
			throw new Error(res.statusText);
		},
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	const paymentMethods = paymentMethodsQuery.data || [];

	// 使用回数順にソート
	const sortedPlaces = [...places].sort((a, b) => b.count - a.count);

	// 店舗名のフィルタリング
	const filteredPlaces = sortedPlaces.filter((place) =>
		place.name.toLowerCase().includes(shopNameQuery.toLowerCase()),
	);

	// 支払い方法のフィルタリング
	const filteredPaymentMethods = paymentMethods.filter((method) =>
		method.name.toLowerCase().includes(paymentMethodQuery.toLowerCase()),
	);

	// 選択された店舗名を取得
	const selectedPlace = places.find(
		(place) => place.name === editableResult.shopName,
	);

	// 選択された支払い方法を取得
	const selectedPaymentMethod = paymentMethods.find(
		(method) => method.name === editableResult.paymentMethodName,
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
								<ComboboxButton as="div" className="w-full">
									<ComboboxInput
										className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
										displayValue={(place: ZaimPlace | null) =>
											place?.name ?? editableResult.shopName
										}
										onChange={(event) => setShopNameQuery(event.target.value)}
										placeholder="店舗名を選択してください"
									/>
									<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
										<ChevronDown className="h-4 w-4 text-gray-400" />
									</div>
								</ComboboxButton>
								<ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
									{(shopNameQuery === "" ? sortedPlaces : filteredPlaces).map(
										(place) => (
											<ComboboxOption
												key={place.uid}
												value={place}
												className="cursor-pointer select-none px-2 py-2 text-xs data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
											>
												{({ selected }) => (
													<div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
														<div className="flex w-3 justify-center">
															{selected && <Check className="h-3 w-3" />}
														</div>
														<span
															className={`truncate ${selected ? "font-medium" : "font-normal"}`}
														>
															{place.name}
														</span>
														<span
															className={`text-right text-xs ${selected ? "text-blue-100" : "text-gray-500"}`}
														>
															{place.count}
														</span>
													</div>
												)}
											</ComboboxOption>
										),
									)}
									{shopNameQuery !== "" && filteredPlaces.length === 0 && (
										<div className="px-4 py-2 text-gray-500 text-sm">
											候補が見つかりません
										</div>
									)}
								</ComboboxOptions>
							</div>
						</Combobox>
					</Field>

					<Field>
						<Label className="mb-1 block font-medium text-gray-600 text-xs">
							支払い方法
						</Label>
						<Combobox
							value={selectedPaymentMethod}
							onChange={(method: ZaimPaymentMethod | null) => {
								if (method) {
									updateBasicInfo("paymentMethodName", method.name);
								}
							}}
						>
							<div className="relative">
								<ComboboxButton as="div" className="w-full">
									<ComboboxInput
										className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
										displayValue={(method: ZaimPaymentMethod | null) =>
											method?.name ?? editableResult.paymentMethodName
										}
										onChange={(event) =>
											setPaymentMethodQuery(event.target.value)
										}
										placeholder="支払い方法を選択してください"
									/>
									<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
										<ChevronDown className="h-4 w-4 text-gray-400" />
									</div>
								</ComboboxButton>
								<ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
									{(paymentMethodQuery === ""
										? paymentMethods
										: filteredPaymentMethods
									).map((method) => (
										<ComboboxOption
											key={method.id}
											value={method}
											className="cursor-pointer select-none px-2 py-2 text-xs data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
										>
											{({ selected }) => (
												<div
													className={`grid items-center gap-2 ${
														"count" in method
															? "grid-cols-[auto_1fr_auto]"
															: "grid-cols-[auto_1fr]"
													}`}
												>
													<div className="flex w-3 justify-center">
														{selected && <Check className="h-3 w-3" />}
													</div>
													<span
														className={`truncate ${selected ? "font-medium" : "font-normal"}`}
													>
														{method.name}
													</span>
												</div>
											)}
										</ComboboxOption>
									))}
									{paymentMethodQuery !== "" &&
										filteredPaymentMethods.length === 0 && (
											<div className="px-4 py-2 text-gray-500 text-sm">
												候補が見つかりません
											</div>
										)}
								</ComboboxOptions>
							</div>
						</Combobox>
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

					<div className="rounded border border-gray-300 bg-white">
						<div className="border-gray-200 border-b bg-gray-50 px-3 py-2">
							<h3 className="font-medium text-gray-900 text-sm">
								商品一覧 ({editableResult.items.length}件)
							</h3>
						</div>
						<div>
							{editableResult.items.map((item, index) => (
								<div
									key={`item-${index}-${item.name}`}
									className="border-gray-200 border-b bg-gray-50 p-2 last:border-b-0"
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
						</div>
					</div>
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
