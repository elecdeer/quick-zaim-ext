import {
	createExtractionApiClient,
	createZaimApiClient,
	type Receipt,
} from "@repo/workers/client";
import {
	QueryClient,
	QueryClientProvider,
	useMutation,
} from "@tanstack/react-query";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { type FC, useCallback, useState } from "react";
import { browser } from "wxt/browser";

// TODO: 環境変数などからベース URL を取得するようにする
const apiClient = createZaimApiClient("http://localhost:8787");
const extractionClient = createExtractionApiClient("http://localhost:8787");

// QueryClient を作成
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: 1,
		},
	},
});

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<MainContent />
		</QueryClientProvider>
	);
}

function MainContent() {
	const [extractResult, setExtractResult] = useState<Receipt | null>(null);

	// Extract mutation を作成
	const extractMutation = useMutation({
		mutationFn: async (): Promise<Receipt> => {
			// DOM情報を取得
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			const tab = tabs[0];

			console.log("activeTab", tab);
			if (!tab || !tab.id) {
				throw new Error("アクティブなタブが見つかりません");
			}

			const [res] = await browser.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["content-scripts/extract.js"],
			});
			console.log(res);

			if (!res.result) {
				throw new Error("DOM情報の取得に失敗しました");
			}

			// API にリクエスト送信
			const response = await extractionClient.index.$post({
				json: {
					ariaSnapshot: res.result as string,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Extraction failed:", errorText);
				throw new Error(`抽出に失敗しました: ${errorText}`);
			}

			const data = await response.json();
			console.log("Extraction successful:", data);
			return data as Receipt;
		},
		onSuccess: (data) => {
			setExtractResult(data);
		},
		onError: (error) => {
			console.error("Extract error:", error);
		},
	});

	const handleClick = useCallback(() => {
		extractMutation.mutate();
	}, [extractMutation]);

	return (
		<div className="flex h-screen w-full flex-col items-center justify-start gap-4 bg-gray-100 p-4">
			<h1 className="font-bold text-xl">Quick Zaim Extension</h1>
			<Button
				className=""
				onClick={handleClick}
				disabled={extractMutation.isPending}
			>
				{extractMutation.isPending ? "抽出中..." : "Extract"}
			</Button>

			{extractMutation.isError && (
				<div className="w-full max-w-md rounded bg-red-100 p-3 text-red-700">
					{extractMutation.error?.message || "エラーが発生しました"}
				</div>
			)}

			{extractResult && (
				<ExtractResultDisplay
					result={extractResult}
					onClear={() => setExtractResult(null)}
					onUpdate={(updatedResult) => setExtractResult(updatedResult)}
				/>
			)}
			<LoginButton />
			<ZaimLoginButton />
			<CategoriesButton />

			<PlacesButton />

			<LogoutButton />
		</div>
	);
}

const Button: FC<ComponentPropsWithRef<"button">> = ({
	className,
	...props
}) => {
	return (
		<button
			className={clsx(
				"w-24 rounded bg-blue-500 px-4 py-2 text-white hover:cursor-pointer hover:bg-blue-900 active:translate-y-0.5 disabled:cursor-not-allowed disabled:bg-gray-400",
				className,
			)}
			type="button"
			{...props}
		/>
	);
};

// 各ボタンコンポーネント
const LoginButton: FC = () => {
	const loginMutation = useMutation({
		mutationFn: async () => {
			const url = new URL("http://localhost:8787/login");
			url.searchParams.set(
				"return-to",
				"https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org",
			);

			const res = await browser.identity.launchWebAuthFlow({
				interactive: true,
				url: url.toString(),
			});
			return res;
		},
		onSuccess: (data) => {
			console.log("Login success:", data);
		},
		onError: (error) => {
			console.error("Login error:", error);
		},
	});

	return (
		<Button
			type="button"
			onClick={() => loginMutation.mutate()}
			disabled={loginMutation.isPending}
		>
			{loginMutation.isPending ? "ログイン中..." : "Login"}
		</Button>
	);
};

const ZaimLoginButton: FC = () => {
	const zaimLoginMutation = useMutation({
		mutationFn: async () => {
			const res = await apiClient.login.$post({
				query: {
					"return-to":
						"https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org",
				},
			});
			const { userAuthorizeUrl } = await res.json();

			console.log({ userAuthorizeUrl });

			const res2 = await browser.identity.launchWebAuthFlow({
				interactive: true,
				url: userAuthorizeUrl,
			});
			return res2;
		},
		onSuccess: (data) => {
			console.log("Zaim login success:", data);
		},
		onError: (error) => {
			console.error("Zaim login error:", error);
		},
	});

	return (
		<Button
			type="button"
			onClick={() => zaimLoginMutation.mutate()}
			disabled={zaimLoginMutation.isPending}
		>
			{zaimLoginMutation.isPending ? "ログイン中..." : "Zaim Login"}
		</Button>
	);
};

const CategoriesButton: FC = () => {
	const categoriesMutation = useMutation({
		mutationFn: async () => {
			const res = await apiClient.categories.$get();

			console.log(res);

			if (res.ok) {
				const data = await res.json();
				console.log(data);
				return data;
			}
			throw new Error(res.statusText);
		},
		onSuccess: (data) => {
			console.log("Categories success:", data);
		},
		onError: (error) => {
			console.error("Categories error:", error);
		},
	});

	return (
		<Button
			type="button"
			onClick={() => categoriesMutation.mutate()}
			disabled={categoriesMutation.isPending}
		>
			{categoriesMutation.isPending ? "取得中..." : "Hello"}
		</Button>
	);
};

const PlacesButton: FC = () => {
	const placesMutation = useMutation({
		mutationFn: async () => {
			const res = await apiClient.places.$get();

			console.log(res);

			if (res.ok) {
				const data = await res.json();
				console.log(data);
				return data;
			}
			throw new Error(res.statusText);
		},
		onSuccess: (data) => {
			console.log("Places success:", data);
		},
		onError: (error) => {
			console.error("Places error:", error);
		},
	});

	return (
		<Button
			type="button"
			onClick={() => placesMutation.mutate()}
			disabled={placesMutation.isPending}
		>
			{placesMutation.isPending ? "取得中..." : "Places"}
		</Button>
	);
};

const LogoutButton: FC = () => {
	const logoutMutation = useMutation({
		mutationFn: async () => {
			const url = new URL("http://localhost:8787/logout");
			const res = await fetch(url, {
				method: "GET",
			});
			console.log(res);
			return res;
		},
		onSuccess: (data) => {
			console.log("Logout success:", data);
		},
		onError: (error) => {
			console.error("Logout error:", error);
		},
	});

	return (
		<Button
			type="button"
			onClick={() => logoutMutation.mutate()}
			disabled={logoutMutation.isPending}
		>
			{logoutMutation.isPending ? "ログアウト中..." : "Logout"}
		</Button>
	);
};

const ExtractResultDisplay: FC<{
	result: Receipt;
	onClear: () => void;
	onUpdate?: (updatedResult: Receipt) => void;
}> = ({ result, onClear, onUpdate }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editableResult, setEditableResult] = useState<Receipt>(result);

	// 編集内容を保存
	const handleSave = () => {
		if (onUpdate) {
			onUpdate(editableResult);
		}
		setIsEditing(false);
	};

	// 編集をキャンセル
	const handleCancel = () => {
		setEditableResult(result);
		setIsEditing(false);
	};

	// 商品項目の更新
	const updateItem = (
		index: number,
		field: keyof Receipt["items"][0],
		value: string | number,
	) => {
		const updatedItems = [...editableResult.items];
		updatedItems[index] = { ...updatedItems[index], [field]: value };
		setEditableResult({ ...editableResult, items: updatedItems });
	};

	// 商品項目の削除
	const removeItem = (index: number) => {
		const updatedItems = editableResult.items.filter((_, i) => i !== index);
		setEditableResult({ ...editableResult, items: updatedItems });
	};
	return (
		<div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-bold text-gray-800 text-lg">抽出結果</h2>
				<div className="flex gap-2">
					{isEditing ? (
						<>
							<button
								type="button"
								onClick={handleSave}
								className="rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
							>
								保存
							</button>
							<button
								type="button"
								onClick={handleCancel}
								className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
							>
								キャンセル
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={() => setIsEditing(true)}
							className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
						>
							編集
						</button>
					)}
					<button
						type="button"
						onClick={onClear}
						className="rounded bg-gray-200 px-3 py-1 text-gray-600 text-sm hover:bg-gray-300"
					>
						×
					</button>
				</div>
			</div>

			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="mb-1 block font-medium text-gray-600 text-sm">
							購入日
						</label>
						{isEditing ? (
							<input
								type="date"
								value={editableResult.date}
								onChange={(e) =>
									setEditableResult({ ...editableResult, date: e.target.value })
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						) : (
							<p className="text-gray-800">{result.date}</p>
						)}
					</div>
					<div>
						<label className="mb-1 block font-medium text-gray-600 text-sm">
							店舗名
						</label>
						{isEditing ? (
							<input
								type="text"
								value={editableResult.shopName}
								onChange={(e) =>
									setEditableResult({
										...editableResult,
										shopName: e.target.value,
									})
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						) : (
							<p className="text-gray-800">{result.shopName}</p>
						)}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="mb-1 block font-medium text-gray-600 text-sm">
							支払い方法
						</label>
						{isEditing ? (
							<input
								type="text"
								value={editableResult.paymentMethodName}
								onChange={(e) =>
									setEditableResult({
										...editableResult,
										paymentMethodName: e.target.value,
									})
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						) : (
							<p className="text-gray-800">{result.paymentMethodName}</p>
						)}
					</div>
					<div>
						<label className="mb-1 block font-medium text-gray-600 text-sm">
							合計金額
						</label>
						{isEditing ? (
							<input
								type="number"
								value={editableResult.sumPrice}
								onChange={(e) =>
									setEditableResult({
										...editableResult,
										sumPrice: Number(e.target.value),
									})
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						) : (
							<p className="font-bold text-gray-800 text-lg">
								¥{result.sumPrice.toLocaleString()}
							</p>
						)}
					</div>
				</div>

				<div>
					<div className="mb-2 block font-medium text-gray-600 text-sm">
						商品一覧
					</div>
					<div className="max-h-64 space-y-2 overflow-y-auto">
						{(isEditing ? editableResult.items : result.items).map(
							(item, index) => (
								<div
									key={`item-${index}-${item.name}`}
									className="rounded-lg border bg-gray-50 p-3"
								>
									{isEditing ? (
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<div className="flex-1 space-y-2">
													<div>
														<label className="mb-1 block text-gray-600 text-xs">
															商品名
														</label>
														<input
															type="text"
															value={item.normalizedName}
															onChange={(e) =>
																updateItem(
																	index,
																	"normalizedName",
																	e.target.value,
																)
															}
															className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
														/>
													</div>
													<div>
														<label className="mb-1 block text-gray-600 text-xs">
															カテゴリ
														</label>
														<input
															type="text"
															value={item.category}
															onChange={(e) =>
																updateItem(index, "category", e.target.value)
															}
															className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
														/>
													</div>
												</div>
												<div className="ml-4 space-y-2">
													<div>
														<label className="mb-1 block text-gray-600 text-xs">
															価格
														</label>
														<input
															type="number"
															value={item.priceYen}
															onChange={(e) =>
																updateItem(
																	index,
																	"priceYen",
																	Number(e.target.value),
																)
															}
															className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
														/>
													</div>
													<div>
														<label className="mb-1 block text-gray-600 text-xs">
															数量
														</label>
														<input
															type="number"
															value={item.amount}
															onChange={(e) =>
																updateItem(
																	index,
																	"amount",
																	Number(e.target.value),
																)
															}
															className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
														/>
													</div>
												</div>
												<button
													type="button"
													onClick={() => removeItem(index)}
													className="ml-2 rounded bg-red-500 px-2 py-1 text-white text-xs hover:bg-red-600"
												>
													削除
												</button>
											</div>
										</div>
									) : (
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<p className="font-medium text-gray-800">
													{item.normalizedName}
												</p>
												<p className="text-gray-600 text-sm">{item.category}</p>
												{item.name !== item.normalizedName && (
													<p className="mt-1 text-gray-500 text-xs">
														元の名前: {item.name}
													</p>
												)}
											</div>
											<div className="text-right">
												<p className="font-medium text-gray-800">
													¥{item.priceYen.toLocaleString()}
												</p>
												<p className="text-gray-600 text-sm">×{item.amount}</p>
											</div>
										</div>
									)}
								</div>
							),
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default App;
