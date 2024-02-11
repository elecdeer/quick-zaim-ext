import { zaimApi } from "./api";

type ZaimGenreRes = {
	genres: {
		id: number;
		category_id: number;
		name: string;
		sort: number;
		active: number;
		modified: string;
		parent_genre_id: number;
		local_id: number;
	}[];
	requested: string;
};

export const fetchZaimGenre = async (): Promise<ZaimGenreRes> => {
	return await zaimApi.get("home/genre").json<ZaimGenreRes>();
};
