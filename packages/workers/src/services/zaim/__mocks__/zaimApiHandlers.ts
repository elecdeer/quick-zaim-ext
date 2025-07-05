import { HttpResponse, http } from "msw";

// テストデータ
export const mockCategories = [
	{
		id: 1,
		name: "食費",
		mode: "payment" as const,
		sort: 1,
		parent_category_id: 0,
		active: 1,
		modified: "2023-01-01T00:00:00Z",
		local_id: 1,
	},
	{
		id: 2,
		name: "日用品",
		mode: "payment" as const,
		sort: 2,
		parent_category_id: 0,
		active: 1,
		modified: "2023-01-01T00:00:00Z",
		local_id: 2,
	},
];

export const mockGenres = [
	{
		id: 101,
		name: "食料品",
		category_id: 1,
		sort: 1,
		active: 1,
		parent_genre_id: 0,
		modified: "2023-01-01T00:00:00Z",
		local_id: 101,
	},
	{
		id: 102,
		name: "外食",
		category_id: 1,
		sort: 2,
		active: 1,
		parent_genre_id: 0,
		modified: "2023-01-01T00:00:00Z",
		local_id: 102,
	},
	{
		id: 201,
		name: "洗剤",
		category_id: 2,
		sort: 1,
		active: 1,
		parent_genre_id: 0,
		modified: "2023-01-01T00:00:00Z",
		local_id: 201,
	},
];

// MSWハンドラー
export const zaimApiHandlers = [
	// カテゴリ取得API
	http.get("https://api.zaim.net/v2/home/category", () => {
		return HttpResponse.json({
			categories: mockCategories,
			requested: Date.now(),
		});
	}),

	// ジャンル取得API
	http.get("https://api.zaim.net/v2/home/genre", () => {
		return HttpResponse.json({
			genres: mockGenres,
			requested: Date.now(),
		});
	}),
];

// エラーレスポンス用のハンドラー
export const createErrorHandlers = () => [
	http.get("https://api.zaim.net/v2/home/category", () => {
		return HttpResponse.json(
			{ error: true, message: "API Error" },
			{ status: 500 },
		);
	}),
	http.get("https://api.zaim.net/v2/home/genre", () => {
		return HttpResponse.json(
			{ error: true, message: "API Error" },
			{ status: 500 },
		);
	}),
];

// カスタムデータ用のハンドラー
export const createCustomHandlers = (
	categories = mockCategories,
	genres = mockGenres,
) => [
	http.get("https://api.zaim.net/v2/home/category", () => {
		return HttpResponse.json({
			categories,
			requested: Date.now(),
		});
	}),
	http.get("https://api.zaim.net/v2/home/genre", () => {
		return HttpResponse.json({
			genres,
			requested: Date.now(),
		});
	}),
];
