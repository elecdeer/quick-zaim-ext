import {
	Button,
	Dialog,
	DialogPanel,
	DialogTitle,
	Disclosure,
	DisclosureButton,
	DisclosurePanel,
	Field,
	Input,
	Label,
} from "@headlessui/react";
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
import {
	ChevronDown,
	Edit3,
	LogOut,
	Save,
	ScanLine,
	Settings,
	Trash2,
	X,
} from "lucide-react";
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
		<div className="flex h-screen w-full flex-col bg-gray-100">
			<div className="border-gray-200 border-b bg-white px-3 py-4">
				<h1 className="font-bold text-gray-800 text-lg">Quick Zaim</h1>
			</div>

			<div className="flex-1 overflow-y-auto px-3 py-4">
				<div className="space-y-4">
					<Button
						onClick={handleClick}
						disabled={extractMutation.isPending}
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
					>
						<ScanLine className="h-4 w-4" />
						{extractMutation.isPending ? "抽出中..." : "レシートを抽出"}
					</Button>

					{extractMutation.isError && (
						<div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-700 text-sm">
							{extractMutation.error?.message || "エラーが発生しました"}
						</div>
					)}

					<Disclosure>
						<DisclosureButton className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-200 px-3 py-2.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
							<Settings className="h-4 w-4" />
							認証・設定
						</DisclosureButton>
						<DisclosurePanel className="mt-2 space-y-2">
							<LoginButton />
							<ZaimLoginButton />
							<CategoriesButton />
							<PlacesButton />
							<LogoutButton />
						</DisclosurePanel>
					</Disclosure>

					{extractResult && (
						<ExtractResultDisplay
							result={extractResult}
							onClear={() => setExtractResult(null)}
							onUpdate={(updatedResult) => setExtractResult(updatedResult)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

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
			onClick={() => loginMutation.mutate()}
			disabled={loginMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{loginMutation.isPending ? "ログイン中..." : "ログイン"}
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
			onClick={() => zaimLoginMutation.mutate()}
			disabled={zaimLoginMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{zaimLoginMutation.isPending ? "ログイン中..." : "Zaimログイン"}
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
			onClick={() => categoriesMutation.mutate()}
			disabled={categoriesMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-gray-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{categoriesMutation.isPending ? "取得中..." : "カテゴリ取得"}
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
			onClick={() => placesMutation.mutate()}
			disabled={placesMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-gray-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{placesMutation.isPending ? "取得中..." : "場所取得"}
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
			onClick={() => logoutMutation.mutate()}
			disabled={logoutMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-red-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			<LogOut className="h-4 w-4" />
			{logoutMutation.isPending ? "ログアウト中..." : "ログアウト"}
		</Button>
	);
};

const ExtractResultDisplay: FC<{
	result: Receipt;
	onClear: () => void;
	onUpdate?: (updatedResult: Receipt) => void;
}> = ({ result, onClear, onUpdate }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [editableResult, setEditableResult] = useState<Receipt>(result);

	// 編集内容を保存
	const handleSave = () => {
		if (onUpdate) {
			onUpdate(editableResult);
		}
		setIsOpen(false);
	};

	// 編集をキャンセル
	const handleCancel = () => {
		setEditableResult(result);
		setIsOpen(false);
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
		<>
			<div className="w-full rounded-lg bg-white p-3 shadow-sm">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-bold text-base text-gray-800">抽出結果</h2>
					<div className="flex gap-1">
						<Button
							onClick={() => setIsOpen(true)}
							className="flex items-center gap-1 rounded bg-blue-500 px-2 py-1 text-white text-xs hover:bg-blue-600"
						>
							<Edit3 className="h-3 w-3" />
							編集
						</Button>
						<Button
							onClick={onClear}
							className="flex items-center justify-center rounded bg-gray-200 px-2 py-1 text-gray-600 text-xs hover:bg-gray-300"
						>
							<X className="h-3 w-3" />
						</Button>
					</div>
				</div>

				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<p className="mb-1 font-medium text-gray-600 text-xs">購入日</p>
							<p className="text-gray-800 text-sm">{result.date}</p>
						</div>
						<div>
							<p className="mb-1 font-medium text-gray-600 text-xs">店舗名</p>
							<p className="text-gray-800 text-sm">{result.shopName}</p>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<p className="mb-1 font-medium text-gray-600 text-xs">
								支払い方法
							</p>
							<p className="text-gray-800 text-sm">
								{result.paymentMethodName}
							</p>
						</div>
						<div>
							<p className="mb-1 font-medium text-gray-600 text-xs">合計金額</p>
							<p className="font-bold text-base text-gray-800">
								¥{result.sumPrice.toLocaleString()}
							</p>
						</div>
					</div>

					<Disclosure>
						<DisclosureButton className="flex w-full justify-between rounded bg-gray-100 px-3 py-2 text-left font-medium text-gray-900 text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
							<span>商品一覧 ({result.items.length}件)</span>
							<ChevronDown className="h-4 w-4" />
						</DisclosureButton>
						<DisclosurePanel className="mt-2 max-h-48 space-y-2 overflow-y-auto">
							{result.items.map((item, index) => (
								<div
									key={`item-${index}-${item.name}`}
									className="rounded border bg-gray-50 p-2"
								>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<p className="font-medium text-gray-800 text-sm">
												{item.normalizedName}
											</p>
											<p className="text-gray-600 text-xs">{item.category}</p>
											{item.name !== item.normalizedName && (
												<p className="mt-1 text-gray-500 text-xs">
													元の名前: {item.name}
												</p>
											)}
										</div>
										<div className="text-right">
											<p className="font-medium text-gray-800 text-sm">
												¥{item.priceYen.toLocaleString()}
											</p>
											<p className="text-gray-600 text-xs">×{item.amount}</p>
										</div>
									</div>
								</div>
							))}
						</DisclosurePanel>
					</Disclosure>
				</div>
			</div>

			<Dialog open={isOpen} onClose={setIsOpen} className="relative z-50">
				<div className="fixed inset-0 bg-black/25" />
				<div className="fixed inset-0 flex items-center justify-center p-2">
					<DialogPanel className="max-h-[95vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-4">
						<DialogTitle className="mb-3 font-bold text-base text-gray-900">
							レシート編集
						</DialogTitle>

						<div className="space-y-4">
							<div className="grid grid-cols-1 gap-3">
								<Field>
									<Label className="mb-1 block font-medium text-gray-600 text-xs">
										購入日
									</Label>
									<Input
										type="date"
										value={editableResult.date}
										onChange={(e) =>
											setEditableResult({
												...editableResult,
												date: e.target.value,
											})
										}
										className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
									/>
								</Field>
								<Field>
									<Label className="mb-1 block font-medium text-gray-600 text-xs">
										店舗名
									</Label>
									<Input
										type="text"
										value={editableResult.shopName}
										onChange={(e) =>
											setEditableResult({
												...editableResult,
												shopName: e.target.value,
											})
										}
										className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
									/>
								</Field>
								<Field>
									<Label className="mb-1 block font-medium text-gray-600 text-xs">
										支払い方法
									</Label>
									<Input
										type="text"
										value={editableResult.paymentMethodName}
										onChange={(e) =>
											setEditableResult({
												...editableResult,
												paymentMethodName: e.target.value,
											})
										}
										className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
									/>
								</Field>
								<Field>
									<Label className="mb-1 block font-medium text-gray-600 text-xs">
										合計金額
									</Label>
									<Input
										type="number"
										value={editableResult.sumPrice}
										onChange={(e) =>
											setEditableResult({
												...editableResult,
												sumPrice: Number(e.target.value),
											})
										}
										className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
									/>
								</Field>
							</div>

							<div>
								<h3 className="mb-2 block font-medium text-gray-600 text-sm">
									商品一覧
								</h3>
								<div className="space-y-2">
									{editableResult.items.map((item, index) => (
										<div
											key={`edit-item-${index}-${item.name}`}
											className="rounded border bg-gray-50 p-3"
										>
											<div className="space-y-2">
												<Field>
													<Label className="mb-1 block text-gray-600 text-xs">
														商品名
													</Label>
													<Input
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
												</Field>
												<Field>
													<Label className="mb-1 block text-gray-600 text-xs">
														カテゴリ
													</Label>
													<Input
														type="text"
														value={item.category}
														onChange={(e) =>
															updateItem(index, "category", e.target.value)
														}
														className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
													/>
												</Field>
												<div className="grid grid-cols-2 gap-2">
													<Field>
														<Label className="mb-1 block text-gray-600 text-xs">
															価格
														</Label>
														<Input
															type="number"
															value={item.priceYen}
															onChange={(e) =>
																updateItem(
																	index,
																	"priceYen",
																	Number(e.target.value),
																)
															}
															className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
														/>
													</Field>
													<Field>
														<Label className="mb-1 block text-gray-600 text-xs">
															数量
														</Label>
														<Input
															type="number"
															value={item.amount}
															onChange={(e) =>
																updateItem(
																	index,
																	"amount",
																	Number(e.target.value),
																)
															}
															className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
														/>
													</Field>
												</div>
												<Button
													onClick={() => removeItem(index)}
													className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-white text-xs hover:bg-red-600"
												>
													<Trash2 className="h-3 w-3" />
													削除
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>

						<div className="mt-4 flex justify-end gap-2">
							<Button
								onClick={handleCancel}
								className="flex items-center gap-2 rounded bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600"
							>
								<X className="h-4 w-4" />
								キャンセル
							</Button>
							<Button
								onClick={handleSave}
								className="flex items-center gap-2 rounded bg-green-500 px-3 py-2 text-sm text-white hover:bg-green-600"
							>
								<Save className="h-4 w-4" />
								保存
							</Button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</>
	);
};

export default App;
