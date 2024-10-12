import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { type ZaimMoneyRes, fetchZaimMoney } from "~lib/zaimApi/fetchMoney";

export type ZaimPlace = {
	placeUid: string;
	name: string;
	count: number;
	accountId: string;
	sortDate: number;
};

export const usePaymentPlaceOptions = ({
	today,
	searchText,
	sortType,
}: {
	today: Date;
	searchText: string;
	sortType: "date" | "count";
}): {
	filteredOptions: ZaimPlace[] | undefined;
	findSelectedPlace: (placeUid: string) => ZaimPlace | undefined;
} => {
	const { data: zaimPlaces } = useQuery({
		queryKey: ["places"],
		queryFn: async () => await fetchZaimMoney({ mapping: 1 }),
		select: (data: ZaimMoneyRes) => aggregatePlaces(data, today),
	});

	const filteredOptions = useMemo(() => {
		return zaimPlaces
			?.filter((item) =>
				item.name.toLowerCase().includes(searchText.toLowerCase().trim()),
			)
			.toSorted(sortCompareMap[sortType]);
	}, [searchText, sortType, zaimPlaces, sortCompareMap[sortType]]);

	const findSelectedPlace = useCallback(
		(placeUid: string) => {
			return zaimPlaces?.find((item) => item.placeUid === placeUid);
		},
		[zaimPlaces],
	);

	return {
		filteredOptions,
		findSelectedPlace,
	};
};

/**
 * 今日までの支払い履歴から支払場所の一覧を取得
 *
 * 最も新しい日付のものをsortDateとする
 * 出現回数をカウントするが、同じreceipt_idは複数カウントしない
 */
const aggregatePlaces = (res: ZaimMoneyRes, today: Date) => {
	const places = res.money.map((item) => ({
		placeUid: item.place_uid,
		name: item.place,
		accountId: String(item.from_account_id),
		receiptId: item.receipt_id,
		sortDate: new Date(item.date).getTime(),
	}));

	const deduplicatedPlaces = new Map<string, ZaimPlace>();
	const countedReceiptIds = new Set<number>();

	for (const place of places) {
		if (place.placeUid === "") continue;
		if (place.sortDate > today.getTime()) continue;
		if (countedReceiptIds.has(place.receiptId)) continue;

		const existingPlace = deduplicatedPlaces.get(place.placeUid);

		if (existingPlace) {
			existingPlace.count++;
			// より新しい日付の場合
			if (place.sortDate > existingPlace.sortDate) {
				existingPlace.sortDate = place.sortDate;
				existingPlace.accountId = String(place.accountId);
			}
		} else {
			deduplicatedPlaces.set(place.placeUid, {
				...place,
				count: 1,
			});
		}
		countedReceiptIds.add(place.receiptId);
	}

	return Array.from(deduplicatedPlaces.values());
};

const zaimPlaceCompareByDate = (a: ZaimPlace, b: ZaimPlace) => {
	return b.sortDate - a.sortDate;
};

const zaimPlaceCompareByCount = (a: ZaimPlace, b: ZaimPlace) => {
	return b.count - a.count;
};

const sortCompareMap = {
	date: zaimPlaceCompareByDate,
	count: zaimPlaceCompareByCount,
} satisfies Record<"date" | "count", (a: ZaimPlace, b: ZaimPlace) => number>;
