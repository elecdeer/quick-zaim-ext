import { ExtractError } from "../extractError";

/**
 * 注文番号を抽出する
 *
 * Amazon.co.jp 注文番号: xxx-xxxxxxxx-xxxxxxx という形式で記載されている
 * @param document
 */
export const extractOrderNumber = (document: Document): string => {
	const tables = Array.from(document.querySelectorAll("td"));
	// 入れ子の一番下で"注文番号"という文字列を含むテーブルを抽出
	const orderNumberTable = tables.find(
		(table) =>
			table.textContent !== null &&
			table.querySelector("td") === null &&
			table.textContent.includes("注文番号"),
	);

	if (orderNumberTable === undefined) {
		throw new ExtractError({
			message: "注文番号が取得できませんでした",
			element: tables,
		});
	}

	const orderNumber = orderNumberTable.textContent?.match(
		/[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+/,
	);

	if (orderNumber === null || orderNumber === undefined) {
		throw new ExtractError({
			message: "注文番号が取得できませんでした",
			element: orderNumberTable,
		});
	}

	return orderNumber[0];
};

/**
 * 注文日を抽出する
 *
 * Amazon.co.jp 注文日: xxxx年xx月xx日 という形式で記載されている
 * @param document
 * @returns 注文日 YYYY-MM-DD
 */
export const extractOrderDate = (document: Document): string => {
	const tables = Array.from(document.querySelectorAll("td"));
	// 入れ子の一番下で"注文日"という文字列を含むテーブルを抽出
	const orderDateTd = tables.find(
		(table) =>
			table.textContent !== null &&
			table.querySelector("td") === null &&
			table.textContent.includes("注文日"),
	);

	if (orderDateTd === undefined) {
		throw new ExtractError({
			message: "注文日が取得できませんでした",
			element: tables,
		});
	}

	const orderDate = orderDateTd.textContent?.match(
		/(?<year>\d+)年(?<month>\d+)月(?<day>\d+)日/,
	);

	if (orderDate?.groups === undefined) {
		throw new ExtractError({
			message: "注文日が取得できませんでした",
			element: orderDateTd,
		});
	}

	const year = orderDate.groups.year.padStart(4, "0");
	const month = orderDate.groups.month.padStart(2, "0");
	const day = orderDate.groups.day.padStart(2, "0");

	return `${year}-${month}-${day}`;
};
