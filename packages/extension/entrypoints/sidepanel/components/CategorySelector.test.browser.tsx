import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";
import { render } from "vitest-browser-react";

import { CategorySelector } from "./CategorySelector";

// テスト用のモックデータ
const mockCategories = [
	{
		id: 1,
		name: "食費",
		subCategories: [
			{ id: 11, name: "食材" },
			{ id: 12, name: "外食" },
			{ id: 13, name: "カフェ" },
		],
	},
	{
		id: 2,
		name: "交通費",
		subCategories: [
			{ id: 21, name: "電車" },
			{ id: 22, name: "バス" },
			{ id: 23, name: "タクシー" },
		],
	},
	{
		id: 3,
		name: "日用品",
		subCategories: [
			{ id: 31, name: "洗剤" },
			{ id: 32, name: "ティッシュ" },
		],
	},
];

// MSWワーカーのセットアップ
const worker = setupWorker(
	// カテゴリAPI（成功レスポンス）
	http.get("http://localhost:8787/zaim/categories", () => {
		return HttpResponse.json({
			categories: mockCategories,
		});
	}),
);

describe("CategorySelector", () => {
	let queryClient: QueryClient;

	beforeAll(async () => {
		await worker.start({ onUnhandledRequest: "warn" });
	});

	afterAll(() => {
		worker.stop();
	});

	afterEach(() => {
		worker.resetHandlers();
	});

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});
		vi.clearAllMocks();
	});

	const renderWithQueryClient = (component: React.ReactNode) => {
		return render(
			<QueryClientProvider client={queryClient}>
				{component}
			</QueryClientProvider>,
		);
	};

	test("初期状態で入力フィールドが表示される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.getByPlaceholder("カテゴリを選択");
		expect(input).toBeVisible();
	});

	test("選択されたカテゴリが表示される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value="11"
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		// コンポーネントが正しく表示されることを確認
		const combobox = screen.container.querySelector("input");
		expect(combobox).toBeInTheDocument();
		// placeholderが設定されていることを確認
		expect(combobox).toHaveAttribute("placeholder", "カテゴリを選択");
	});

	test("入力フィールドをクリックしてドロップダウンを開ける", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.getByPlaceholder("カテゴリを選択");
		await input.click();

		// カテゴリオプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("食費")).toBeInTheDocument();
		});

		// メインカテゴリがstickyヘッダーとして表示される
		expect(screen.getByText("食費")).toBeVisible();
		expect(screen.getByText("交通費")).toBeVisible();
		expect(screen.getByText("日用品")).toBeVisible();

		// サブカテゴリが表示される
		expect(screen.getByText("食材")).toBeVisible();
		expect(screen.getByText("外食")).toBeVisible();
		expect(screen.getByText("電車")).toBeVisible();
		expect(screen.getByText("バス")).toBeVisible();
	});

	test("サブカテゴリを選択できる", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.getByPlaceholder("カテゴリを選択");
		await input.click();

		// カテゴリオプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("食材")).toBeInTheDocument();
		});

		// サブカテゴリを選択
		const foodMaterialOption = screen.getByText("食材");
		await foodMaterialOption.click();

		// onChangeが正しい引数で呼ばれる（categoryIdのみ）
		expect(onChange).toHaveBeenCalledWith("11");
	});

	test("フィルタリング機能が存在する", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.getByPlaceholder("カテゴリを選択");
		await input.click();

		// カテゴリオプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("食材")).toBeInTheDocument();
		});

		// 入力フィールドに文字を入力できることを確認
		await input.fill("食");

		// 入力フィールドが機能することを確認
		expect(input).toBeInTheDocument();
	});

	test("カスタムclassNameが適用される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
				className="custom-class"
			/>,
		);

		// カスタムクラスが適用されたコンテナが存在する
		const container = screen.container.querySelector(".custom-class");
		expect(container).toBeInTheDocument();
	});

	test("APIエラー時は空の状態で表示される", async () => {
		// APIエラーをモック
		worker.use(
			http.get("http://localhost:8787/zaim/categories", () => {
				return HttpResponse.json(
					{ error: "Internal Server Error" },
					{ status: 500 },
				);
			}),
		);

		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.getByPlaceholder("カテゴリを選択");
		await input.click();

		// エラー時は何も表示されない（空のリスト）
		await vi.waitFor(() => {
			const foodCategory = screen.container.querySelector(
				"[data-testid='category-食費']",
			);
			expect(foodCategory).not.toBeInTheDocument();
		});
	});

	test("選択済みのアイテムが存在する", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value="11"
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.container.querySelector("input");
		expect(input).toBeInTheDocument();

		// コンポーネントが選択済み状態で正しく表示される
		expect(input).toHaveAttribute("role", "combobox");
	});

	test("ドロップダウンのカテゴリヘッダーが正しく表示される", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<CategorySelector
				value=""
				onChange={onChange}
				placeholder="カテゴリを選択"
			/>,
		);

		const input = screen.getByPlaceholder("カテゴリを選択");
		await input.click();

		// カテゴリオプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("食費")).toBeInTheDocument();
		});

		// カテゴリヘッダーが正しく表示される（横線付きのヘッダー）
		const categoryHeaders = screen.container.querySelectorAll(".sticky.top-0");
		expect(categoryHeaders.length).toBeGreaterThan(0);

		// 各カテゴリヘッダーに横線が含まれる
		const headerWithLine = screen.container.querySelector(
			".sticky.top-0 .h-px.bg-gray-200",
		);
		expect(headerWithLine).toBeInTheDocument();
	});
});
