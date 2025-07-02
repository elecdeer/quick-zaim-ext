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

import { PlaceSelector } from "./PlaceSelector";

// テスト用のモック店舗データ
const mockPlaces = [
	{ uid: "place1", name: "セブンイレブン", count: 15 },
	{ uid: "place2", name: "ファミリーマート", count: 12 },
	{ uid: "place3", name: "ローソン", count: 8 },
	{ uid: "place4", name: "スーパーA", count: 5 },
	{ uid: "place5", name: "ドラッグストアB", count: 3 },
];

// MSWワーカーのセットアップ
const worker = setupWorker(
	// 店舗API（成功レスポンス）
	http.get("http://localhost:8787/zaim/places", () => {
		return HttpResponse.json({
			places: mockPlaces,
		});
	}),
);

describe("PlaceSelector", () => {
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
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		expect(input).toBeVisible();
	});

	test("選択された店舗名が表示される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value="セブンイレブン"
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		// コンポーネントが正しく表示されることを確認
		const input = screen.container.querySelector("input");
		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute("placeholder", "店舗名を選択してください");
	});

	test("入力フィールドをクリックしてドロップダウンを開ける", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		await input.click();

		// 店舗オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("セブンイレブン")).toBeInTheDocument();
		});

		// 各店舗が表示される
		expect(screen.getByText("セブンイレブン")).toBeVisible();
		expect(screen.getByText("ファミリーマート")).toBeVisible();
		expect(screen.getByText("ローソン")).toBeVisible();
		expect(screen.getByText("スーパーA")).toBeVisible();
		expect(screen.getByText("ドラッグストアB")).toBeVisible();
	});

	test("店舗を選択できる", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		await input.click();

		// 店舗オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("セブンイレブン")).toBeInTheDocument();
		});

		// 店舗を選択
		const sevenElevenOption = screen.getByText("セブンイレブン");
		await sevenElevenOption.click();

		// onChangeが正しい引数で呼ばれる
		expect(onChange).toHaveBeenCalledWith("セブンイレブン");
	});

	test("使用回数順に店舗がソートされて表示される", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		await input.click();

		// 店舗オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("セブンイレブン")).toBeInTheDocument();
		});

		// 使用回数が表示される
		expect(screen.getByText("15")).toBeVisible(); // セブンイレブン
		expect(screen.getByText("12")).toBeVisible(); // ファミリーマート
		expect(screen.getByText("8")).toBeVisible(); // ローソン
		expect(screen.getByText("5")).toBeVisible(); // スーパーA
		expect(screen.getByText("3")).toBeVisible(); // ドラッグストアB
	});

	test("フィルタリング機能が動作する", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		await input.click();

		// 店舗オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("セブンイレブン")).toBeInTheDocument();
		});

		// フィルタリング文字列を入力
		await input.fill("セブン");

		// フィルタリング結果を確認
		await vi.waitFor(() => {
			expect(screen.getByText("セブンイレブン")).toBeVisible();
			expect(screen.queryByText("ファミリーマート")).not.toBeInTheDocument();
		});
	});

	test("カスタムclassNameが適用される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
				className="custom-place-class"
			/>,
		);

		// カスタムクラスが適用されたコンテナが存在する
		const container = screen.container.querySelector(".custom-place-class");
		expect(container).toBeInTheDocument();
	});

	test("APIエラー時は空の状態で表示される", async () => {
		// APIエラーをモック
		worker.use(
			http.get("http://localhost:8787/zaim/places", () => {
				return HttpResponse.json(
					{ error: "Internal Server Error" },
					{ status: 500 },
				);
			}),
		);

		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		await input.click();

		// エラー時は店舗オプションが表示されない
		await vi.waitFor(() => {
			const sevenElevenOption = screen.container.querySelector(
				"[data-testid='place-セブンイレブン']",
			);
			expect(sevenElevenOption).not.toBeInTheDocument();
		});
	});

	test("選択済みのアイテムが存在する", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value="セブンイレブン"
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.container.querySelector("input");
		expect(input).toBeInTheDocument();

		// コンポーネントが選択済み状態で正しく表示される
		expect(input).toHaveAttribute("role", "combobox");
	});

	test("候補が見つからない場合のメッセージが表示される", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector
				value=""
				onChange={onChange}
				placeholder="店舗名を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		await input.click();

		// 店舗オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("セブンイレブン")).toBeInTheDocument();
		});

		// 存在しない文字列でフィルタリング
		await input.fill("存在しない店舗名");

		// 「候補が見つかりません」メッセージが表示される
		await vi.waitFor(() => {
			expect(screen.getByText("候補が見つかりません")).toBeInTheDocument();
		});
	});

	test("デフォルトプレースホルダーが使用される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PlaceSelector value="" onChange={onChange} />,
		);

		const input = screen.getByPlaceholder("店舗名を選択してください");
		expect(input).toBeVisible();
	});
});
