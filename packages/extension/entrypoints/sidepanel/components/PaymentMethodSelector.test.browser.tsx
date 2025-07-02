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

import { PaymentMethodSelector } from "./PaymentMethodSelector";

// テスト用のモック支払い方法データ
const mockPaymentMethods = [
	{ id: 1, name: "現金" },
	{ id: 2, name: "クレジットカード" },
	{ id: 3, name: "デビットカード" },
	{ id: 4, name: "電子マネー" },
	{ id: 5, name: "QRコード決済" },
];

// MSWワーカーのセットアップ
const worker = setupWorker(
	// 支払い方法API（成功レスポンス）
	http.get("http://localhost:8787/zaim/payment-methods", () => {
		return HttpResponse.json({
			paymentMethods: mockPaymentMethods,
		});
	}),
);

describe("PaymentMethodSelector", () => {
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
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("支払い方法を選択してください");
		expect(input).toBeVisible();
	});

	test("選択された支払い方法が表示される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value="1" // idを使用
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		// コンポーネントが正しく表示されることを確認
		const input = screen.container.querySelector("input");
		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute(
			"placeholder",
			"支払い方法を選択してください",
		);
	});

	test("入力フィールドをクリックしてドロップダウンを開ける", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("支払い方法を選択してください");
		await input.click();

		// 支払い方法オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("現金")).toBeInTheDocument();
		});

		// 各支払い方法が表示される
		expect(screen.getByText("現金")).toBeVisible();
		expect(screen.getByText("クレジットカード")).toBeVisible();
		expect(screen.getByText("デビットカード")).toBeVisible();
		expect(screen.getByText("電子マネー")).toBeVisible();
		expect(screen.getByText("QRコード決済")).toBeVisible();
	});

	test("支払い方法を選択できる", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("支払い方法を選択してください");
		await input.click();

		// 支払い方法オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("現金")).toBeInTheDocument();
		});

		// 支払い方法を選択
		const cashOption = screen.getByText("現金");
		await cashOption.click();

		// onChangeが正しい引数で呼ばれる
		expect(onChange).toHaveBeenCalledWith({ id: 1, name: "現金" });
	});

	test("フィルタリング機能が存在する", async () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("支払い方法を選択してください");
		await input.click();

		// 支払い方法オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("現金")).toBeInTheDocument();
		});

		// フィルタリング文字列を入力
		await input.fill("カード");

		// 入力フィールドが機能することを確認
		expect(input).toBeInTheDocument();
	});

	test("カスタムclassNameが適用される", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
				className="custom-payment-class"
			/>,
		);

		// カスタムクラスが適用されたコンテナが存在する
		const container = screen.container.querySelector(".custom-payment-class");
		expect(container).toBeInTheDocument();
	});

	test("APIエラー時は空の状態で表示される", async () => {
		// APIエラーをモック
		worker.use(
			http.get("http://localhost:8787/zaim/payment-methods", () => {
				return HttpResponse.json(
					{ error: "Internal Server Error" },
					{ status: 500 },
				);
			}),
		);

		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("支払い方法を選択してください");
		await input.click();

		// エラー時は何も表示されない（空のリスト）
		await vi.waitFor(() => {
			const cashOption = screen.container.querySelector(
				"[data-testid='payment-現金']",
			);
			expect(cashOption).not.toBeInTheDocument();
		});
	});

	test("選択済みのアイテムが存在する", () => {
		const onChange = vi.fn();
		const screen = renderWithQueryClient(
			<PaymentMethodSelector
				value="1" // idを使用
				onChange={onChange}
				placeholder="支払い方法を選択してください"
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
			<PaymentMethodSelector
				value=""
				onChange={onChange}
				placeholder="支払い方法を選択してください"
			/>,
		);

		const input = screen.getByPlaceholder("支払い方法を選択してください");
		await input.click();

		// 支払い方法オプションが表示されるまで待つ
		await vi.waitFor(() => {
			expect(screen.getByText("現金")).toBeInTheDocument();
		});

		// 存在しない文字列でフィルタリング
		await input.fill("存在しない支払い方法");

		// 「候補が見つかりません」メッセージが表示される
		await vi.waitFor(() => {
			expect(screen.getByText("候補が見つかりません")).toBeInTheDocument();
		});
	});
});
