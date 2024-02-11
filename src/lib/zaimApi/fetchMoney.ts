import { zaimApi } from "./api";

export type ZaimMoneyRes = {
	money: {
		id: string;
		amount: number;
		date: string;
		category_id: number;
		genre_id: number;
		from_account_id: number;
		comment: string;
		active: number;
		name: string;
		receipt_id: number;
		place: string;
		place_uid: string;
		currency_code: string;
		created: string;
	}[];
	requested: string;
};

export type ZaimMoneyReq = {
	/** required. set 1 */
	mapping: 1;
	/** narrow down by category_id */
	category_id?: number | undefined;
	/** narrow down by genre_id */
	genre_id?: number | undefined;
	/** narrow down by type (payment or income or transfer) */
	mode?: "payment" | "income" | undefined;
	/** sort by id or date (default : date) */
	order?: "id" | "date" | undefined;
	/** the first date (Y-m-d format) */
	start_date?: string | undefined;
	/** the last date (Y-m-d format) */
	end_date?: string | undefined;
	/** number of current page (default 1) */
	page?: number | undefined;
	/** number of items per page (default 20, max 100) */
	limit?: number | undefined;
	/** if you set as "receipt_id", Zaim makes the response group by the receipt_id (option) */
	group_by?: "receipt_id" | undefined;
};

export const fetchZaimMoney = async (
	req: ZaimMoneyReq,
): Promise<ZaimMoneyRes> => {
	return await zaimApi
		.get("home/money", { searchParams: req })
		.json<ZaimMoneyRes>();
};
