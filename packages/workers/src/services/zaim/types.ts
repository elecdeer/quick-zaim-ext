// 整形後のデータ型を定義
export type ZaimCategory = {
	id: string;
	name: string;
	subCategories: { id: string; name: string }[];
};
export type ZaimPaymentMethod = {
	id: string;
	name: string;
};
