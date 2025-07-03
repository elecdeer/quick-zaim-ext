import type { CreateReceiptRequest, Receipt } from "@repo/workers/client";
import { useReducer } from "react";

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
	orderNo: string;
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
	| { type: "UPDATE_ITEM_FULL"; index: number; item: ReceiptState["items"][0] }
	| { type: "SET_EXTRACT_RESULT"; receipt: Receipt };

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
		case "SET_EXTRACT_RESULT":
			return receiptToState(action.receipt);
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
		orderNo: receipt.orderNo,
	};
}

// 初期状態を作成する関数
function createInitialState(): ReceiptState {
	return {
		date: "",
		items: [],
		shopId: null,
		paymentMethodId: "",
		sumPrice: 0,
		orderNo: "",
	};
}

// ReceiptStateからCreateReceiptRequest型に変換
function stateToCreateReceiptRequest(
	state: ReceiptState,
): CreateReceiptRequest {
	return {
		date: state.date,
		items: state.items.map((item) => ({
			name: item.name,
			amount: item.amount,
			categoryId: item.categoryId,
			priceYen: item.priceYen,
		})),
		shopId: state.shopId,
		paymentMethodId: state.paymentMethodId,
		receiptId: state.orderNo, // orderNo（注文番号）をreceiptId（Zaim用ID）として使用
	};
}

export function useReceiptState() {
	const [state, dispatch] = useReducer(receiptReducer, createInitialState());

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

	// 抽出結果の設定
	const setExtractResult = (receipt: Receipt) => {
		dispatch({ type: "SET_EXTRACT_RESULT", receipt });
	};

	// 送信用データの変換
	const toCreateReceiptRequest = (): CreateReceiptRequest => {
		return stateToCreateReceiptRequest(state);
	};

	return {
		state,
		updateBasicInfo,
		updateItem,
		removeItem,
		addItem,
		updateItemFull,
		setExtractResult,
		toCreateReceiptRequest,
	};
}
