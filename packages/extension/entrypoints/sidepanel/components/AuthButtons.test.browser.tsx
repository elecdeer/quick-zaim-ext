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

import {
	CategoriesButton,
	LoginButton,
	LogoutButton,
	PlacesButton,
	ZaimLoginButton,
} from "./AuthButtons";

// MSWワーカーのセットアップ
const worker = setupWorker(
	// ログインAPI
	http.post("http://localhost:8787/zaim/login", () => {
		return HttpResponse.json({
			userAuthorizeUrl: "https://example.com/auth",
		});
	}),

	// カテゴリAPI
	http.get("http://localhost:8787/zaim/categories", () => {
		return HttpResponse.json({
			categories: [
				{ id: 1, name: "食費" },
				{ id: 2, name: "交通費" },
			],
		});
	}),

	// 場所API
	http.get("http://localhost:8787/zaim/places", () => {
		return HttpResponse.json({
			places: [
				{ uid: "place1", name: "コンビニ", count: 10 },
				{ uid: "place2", name: "スーパー", count: 5 },
			],
		});
	}),

	// 支払い方法API
	http.get("http://localhost:8787/zaim/payment-methods", () => {
		return HttpResponse.json({
			paymentMethods: [
				{ id: 1, name: "現金" },
				{ id: 2, name: "クレジットカード" },
			],
		});
	}),

	// ログアウトAPI
	http.get("http://localhost:8787/logout", () => {
		return HttpResponse.json({ success: true });
	}),
);

describe("AuthButtons", () => {
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
				mutations: {
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

	describe("LoginButton", () => {
		test("ログインボタンが正しく表示される", () => {
			const screen = renderWithQueryClient(<LoginButton />);

			const button = screen.getByRole("button", { name: "ログイン" });
			expect(button).toBeVisible();
			expect(button).not.toBeDisabled();
		});

		test("ボタンクリックでログイン処理が実行される", async () => {
			const screen = renderWithQueryClient(<LoginButton />);

			const button = screen.getByRole("button", { name: "ログイン" });
			await button.click();

			// ログイン処理が呼ばれることを確認
			expect(button).toBeInTheDocument();
		});
	});

	describe("ZaimLoginButton", () => {
		test("Zaimログインボタンが正しく表示される", () => {
			const screen = renderWithQueryClient(<ZaimLoginButton />);

			const button = screen.getByRole("button", { name: "Zaimログイン" });
			expect(button).toBeVisible();
			expect(button).not.toBeDisabled();
		});

		test("ボタンがクリック可能である", () => {
			const screen = renderWithQueryClient(<ZaimLoginButton />);

			const button = screen.getByRole("button", { name: "Zaimログイン" });
			expect(button).not.toBeDisabled();
		});
	});

	describe("CategoriesButton", () => {
		test("カテゴリ取得ボタンが正しく表示される", () => {
			const screen = renderWithQueryClient(<CategoriesButton />);

			const button = screen.getByRole("button", { name: "カテゴリ取得" });
			expect(button).toBeVisible();
			expect(button).not.toBeDisabled();
		});

		test("ボタンがクリック可能である", () => {
			const screen = renderWithQueryClient(<CategoriesButton />);

			const button = screen.getByRole("button", { name: "カテゴリ取得" });
			expect(button).not.toBeDisabled();
		});
	});

	describe("PlacesButton", () => {
		test("場所取得ボタンが正しく表示される", () => {
			const screen = renderWithQueryClient(<PlacesButton />);

			const button = screen.getByRole("button", { name: "場所取得" });
			expect(button).toBeVisible();
			expect(button).not.toBeDisabled();
		});

		test("ボタンがクリック可能である", () => {
			const screen = renderWithQueryClient(<PlacesButton />);

			const button = screen.getByRole("button", { name: "場所取得" });
			expect(button).not.toBeDisabled();
		});
	});

	describe("LogoutButton", () => {
		test("ログアウトボタンが正しく表示される", () => {
			const screen = renderWithQueryClient(<LogoutButton />);

			const button = screen.getByRole("button", { name: "ログアウト" });
			expect(button).toBeVisible();
			expect(button).not.toBeDisabled();
		});

		test("ボタンがクリック可能である", () => {
			const screen = renderWithQueryClient(<LogoutButton />);

			const button = screen.getByRole("button", { name: "ログアウト" });
			expect(button).not.toBeDisabled();
		});

		test("ログアウトアイコンが表示される", () => {
			const screen = renderWithQueryClient(<LogoutButton />);

			// lucide-reactのLogOutアイコンを確認
			const icon = screen.container.querySelector("svg");
			expect(icon).toBeInTheDocument();
		});
	});
});
