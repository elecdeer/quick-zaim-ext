import { ExtractError } from "../../extractError";
import type { ExtractedOrder, ExtractedProduct } from "../../extractTypes";
import { parsePriceYen } from "../../extractUtil";
import { extractOrderDate, extractOrderNumber } from "./extractOrderInfo";

//TODO: ギフト券に対応する
//TODO: 支払方法を紐付けを追加し、自動で入力するようにする

export const extractDeliveryOrder = (document: Document): ExtractedOrder => {
	const products = extractProducts(document);
	const expenses = extractExpenses(document);
	const orderNumber = extractOrderNumber(document);
	const orderDate = extractOrderDate(document);

	return {
		orderNumber,
		orderDate,
		products: [...products, ...expenses],
	} satisfies ExtractedOrder;
};

const extractProducts = (document: Document): ExtractedProduct[] => {
	const tables = Array.from(document.querySelectorAll("tbody"));

	// 入れ子の一番下で"注文商品"という文字列を含むテーブルを抽出
	const productsTables = tables.filter(
		(table) =>
			table.textContent !== null &&
			table.querySelector("tbody") === null &&
			table.textContent.includes("注文商品"),
	);

	return productsTables.flatMap((table) => {
		const trList = Array.from(table.querySelectorAll("tr"));
		// 一番上のtrは"注文商品"なので除外
		return trList.slice(1).map((tr) => {
			const quantity = extractQuantity(tr);
			const productName = extractProductName(tr);
			const price = extractPrice(tr);
			return {
				productName,
				priceYen: price,
				quantity,
			} satisfies ExtractedProduct;
		});
	});
};

// 個数を取得する関数
const extractQuantity = (tr: HTMLElement): number => {
	const quantityElement = tr.querySelector('input[type="hidden"]');
	const quantity = quantityElement?.getAttribute("value");
	if (quantity === null || quantity === undefined) {
		throw new ExtractError({
			message: "個数が取得できませんでした",
			element: tr,
		});
	}
	return parseInt(quantity, 10);
};

// 商品名を取得する関数
const extractProductName = (tr: HTMLElement): string => {
	const productNameElement = tr.querySelector("i");
	const productName = productNameElement?.textContent?.trim();
	if (productName === null || productName === undefined) {
		throw new ExtractError({
			message: "商品名が取得できませんでした",
			element: tr,
		});
	}
	return productName;
};

// 価格を取得する関数
const extractPrice = (tr: HTMLElement): number => {
	const priceElement = tr.querySelector("td:last-child");
	const price = priceElement?.textContent?.trim();
	if (price === null || price === undefined) {
		throw new ExtractError({
			message: "価格が取得できませんでした",
			element: tr,
		});
	}
	return parsePriceYen(price);
};

/**
 * 配送料やポイントで支払った場合はその分のExtractedProductを追加する
 * @param document
 */
const extractExpenses = (document: Document): ExtractedProduct[] => {
	const tables = Array.from(document.querySelectorAll("tbody"));

	const expensesTable = tables.find(
		(table) =>
			table.textContent !== null &&
			table.querySelector("tbody") === null &&
			table.textContent.includes("注文合計"),
	);

	if (expensesTable === undefined) {
		throw new ExtractError({
			message: "支払項目が取得できませんでした",
			element: tables,
		});
	}

	// "配送料・手数料"という文字列を含むtrを抽出
	const deliveryCharge = extractDeliveryCharge(expensesTable);
	const pointPayment = extractPointPayment(expensesTable);
	const discount = extractDiscount(expensesTable);

	return [deliveryCharge, pointPayment, discount].filter(
		(product): product is ExtractedProduct => product !== undefined,
	);
};

const extractDeliveryCharge = (
	expensesTable: HTMLTableSectionElement,
): ExtractedProduct | undefined => {
	// "配送料・手数料"という文字列を含むtrを抽出
	const deliveryChargeTr = Array.from(
		expensesTable.querySelectorAll("tr"),
	).find((tr) => tr.textContent?.includes("配送料・手数料"));

	if (deliveryChargeTr === undefined) {
		return undefined;
	}

	const deliveryChargeStr =
		deliveryChargeTr?.lastElementChild?.textContent?.trim();
	if (deliveryChargeStr === undefined) {
		return undefined;
	}
	const deliveryCharge = parsePriceYen(deliveryChargeStr);

	return {
		productName: "配送料・手数料",
		priceYen: deliveryCharge,
		quantity: 1,
	} satisfies ExtractedProduct;
};

const extractPointPayment = (
	expensesTable: HTMLTableSectionElement,
): ExtractedProduct | undefined => {
	// "ポイント"という文字列を含むtrを抽出
	const pointPaymentTr = Array.from(expensesTable.querySelectorAll("tr")).find(
		(tr) => tr.textContent?.includes("Amazonポイント"),
	);

	if (pointPaymentTr === undefined) {
		return undefined;
	}

	const pointPaymentStr = pointPaymentTr?.lastElementChild?.textContent?.trim();
	if (pointPaymentStr === undefined) {
		return undefined;
	}
	const pointPayment = parsePriceYen(pointPaymentStr);

	return {
		productName: "ポイント支払",
		priceYen: pointPayment,
		quantity: 1,
	} satisfies ExtractedProduct;
};

const extractDiscount = (
	expensesTable: HTMLTableSectionElement,
): ExtractedProduct | undefined => {
	// "割引"という文字列を含むtrを抽出
	const discountTr = Array.from(expensesTable.querySelectorAll("tr")).find(
		(tr) => tr.textContent?.includes("割引"),
	);

	if (discountTr === undefined) {
		return undefined;
	}

	const discountStr = discountTr?.lastElementChild?.textContent?.trim();
	if (discountStr === undefined) {
		return undefined;
	}
	const discount = parsePriceYen(discountStr);

	return {
		productName: "割引",
		priceYen: discount,
		quantity: 1,
	} satisfies ExtractedProduct;
};
