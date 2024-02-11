import { formatToYYYYMMDD } from "../dateUtil";
import {
	type ZaimPaymentReq,
	type ZaimPaymentRes,
	postZaimPayment,
} from "../zaimApi/postPayment";

export type PaymentRecords = {
	items: {
		uid: string;
		itemName: string;
		categoryId: number;
		genreId: number;
		pricePerItem: number;
		quantity: number;
		comment?: string | undefined;
	}[];
	date: Date;
	placeUid?: string | undefined;
	fromAccountId: number;
};

// TODO: ZaimPaymentResの型？

export const postPayments = async (
	records: PaymentRecords,
	bulk = true,
): Promise<ZaimPaymentRes[]> => {
	const { items, date, placeUid, fromAccountId } = records;
	const dateStr = formatToYYYYMMDD(date);

	// ユニークなレシートIDを生成
	const receiptId = bulk ? Math.floor(Date.now() / 1000) : undefined;
	const payments = items.map((item) => {
		return {
			mapping: 1,
			category_id: item.categoryId,
			genre_id: item.genreId,
			amount: item.pricePerItem * item.quantity,
			date: dateStr,
			name: item.itemName,
			place_uid: placeUid,
			from_account_id: fromAccountId,
			receipt_id: receiptId,
			comment: item.comment,
		} satisfies ZaimPaymentReq;
	});

	console.log("postPayments", payments);
	const res = await Promise.all(
		payments.map((payment) => postZaimPayment(payment)),
	);
	console.log("success", res);

	return res;
};
