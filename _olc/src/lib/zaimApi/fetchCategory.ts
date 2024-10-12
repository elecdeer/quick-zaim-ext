import { zaimApi } from "./api";

type ZaimCategoryRes = {
	categories: {
		id: number;
		mode: "payment" | "income";
		name: string;
		sort: number;
		active: number;
		modified: string;
		parent_category_id: number;
		local_id: number;
	}[];
	requested: string;
};

export const fetchZaimCategory = async (): Promise<ZaimCategoryRes> => {
	return await zaimApi.get("home/category").json<ZaimCategoryRes>();
};
