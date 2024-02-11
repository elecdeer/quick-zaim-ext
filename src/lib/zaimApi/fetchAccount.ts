import { zaimApi } from "./api";

export type ZaimAccountRes = {
	accounts: {
		id: number;
		name: string;
		/** yyyy-mm-dd hh:mm:ss */
		modified: string;
		sort: number;
		active: -1 | 1;
		parent_account_id: number;
		local_id: number;
		website_id: number;
	}[];
	requested: string;
};

export const fetchZaimAccount = async (): Promise<ZaimAccountRes> => {
	return await zaimApi.get("home/account").json<ZaimAccountRes>();
};
