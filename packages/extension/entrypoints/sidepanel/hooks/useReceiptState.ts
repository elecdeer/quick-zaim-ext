import type { Receipt } from "@repo/workers/client";
import { useEffect, useReducer } from "react";

// idから導出可能な情報を除いた最小限の状態
export type ReceiptState = {
	date: string;
	items: {
		name: string;
		normalizedName: string;
		amount: number;
		categoryId: string;
		priceYen: number;
	}[];
	shopId: string | null;
	paymentMethodId: string;
	sumPrice: number;
	receiptId: string;
};

export type ReceiptAction =
	| {
			type: "UPDATE_BASIC_INFO";
			field: keyof Omit<ReceiptState, "items">;
			value: string | number | null;
	  }
	| {
			type: "UPDATE_ITEM";
			index: number;
			field: keyof ReceiptState["items"][0];
			value: string | number;
	  }
	| { type: "REMOVE_ITEM"; index: number }
	| { type: "ADD_ITEM" }
	| { type: "UPDATE_ITEM_FULL"; index: number; item: ReceiptState["items"][0] };

function receiptReducer(
	state: ReceiptState,
	action: ReceiptAction,
): ReceiptState {
	switch (action.type) {
		case "UPDATE_BASIC_INFO":
			return { ...state, [action.field]: action.value };
		case "UPDATE_ITEM":
			return {
				...state,
				items: state.items.map((item, index) =>
					index === action.index
						? { ...item, [action.field]: action.value }
						: item,
				),
			};
		case "REMOVE_ITEM":
			return {
				...state,
				items: state.items.filter((_, index) => index !== action.index),
			};
		case "ADD_ITEM":
			return {
				...state,
				items: [
					...state.items,
					{
						name: "",
						normalizedName: "新しい商品",
						categoryId: "",
						priceYen: 0,
						amount: 1,
					},
				],
			};
		case "UPDATE_ITEM_FULL":
			return {
				...state,
				items: state.items.map((item, index) =>
					index === action.index ? action.item : item,
				),
			};
		default:
			return state;
	}
}

// Receipt型からReceiptState型に変換
function receiptToState(receipt: Receipt): ReceiptState {
	return {
		date: receipt.date,
		items: receipt.items.map((item) => ({
			name: item.name,
			normalizedName: item.normalizedName,
			amount: item.amount,
			categoryId: item.categoryId,
			priceYen: item.priceYen,
		})),
		shopId: receipt.shopId,
		paymentMethodId: receipt.paymentMethodId,
		sumPrice: receipt.sumPrice,
		receiptId: receipt.receiptId,
	};
}

// ReceiptState型からReceipt型に変換
function stateToReceipt(state: ReceiptState): Receipt {
	return {
		...state,
		items: state.items.map((item) => ({
			...item,
			category: "", // categoryIdから導出されるため空文字列
		})),
		shopName: "", // shopIdから導出されるため空文字列
		paymentMethodName: "", // paymentMethodIdから導出されるため空文字列
	};
}

export interface UseReceiptStateProps {
	initialReceipt: Receipt;
	onUpdate?: (updatedReceipt: Receipt) => void;
}

export function useReceiptState({
	initialReceipt,
	onUpdate,
}: UseReceiptStateProps) {
	const [state, dispatch] = useReducer(
		receiptReducer,
		receiptToState(initialReceipt),
	);

	// stateが変更されたらonUpdateを呼び出す
	useEffect(() => {
		if (onUpdate) {
			onUpdate(stateToReceipt(state));
		}
	}, [state, onUpdate]);

	// 基本情報の更新
	const updateBasicInfo = (
		field: keyof Omit<ReceiptState, "items">,
		value: string | number | null,
	) => {
		dispatch({ type: "UPDATE_BASIC_INFO", field, value });
	};

	// 商品項目の更新
	const updateItem = (
		index: number,
		field: keyof ReceiptState["items"][0],
		value: string | number,
	) => {
		dispatch({ type: "UPDATE_ITEM", index, field, value });
	};

	// 商品項目の削除
	const removeItem = (index: number) => {
		dispatch({ type: "REMOVE_ITEM", index });
	};

	// 商品項目の追加
	const addItem = () => {
		dispatch({ type: "ADD_ITEM" });
	};

	// 商品項目の完全更新
	const updateItemFull = (index: number, item: ReceiptState["items"][0]) => {
		dispatch({ type: "UPDATE_ITEM_FULL", index, item });
	};

	return {
		state,
		updateBasicInfo,
		updateItem,
		removeItem,
		addItem,
		updateItemFull,
	};
}
