import {
	Button,
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
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
	type ZaimPlace,
} from "@repo/workers/client";
import {
	QueryClient,
	QueryClientProvider,
	useMutation,
	useQuery,
} from "@tanstack/react-query";
import {
	Check,
	ChevronDown,
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
	const categoriesQuery = useQuery({
		queryKey: ["categories"],
		queryFn: async () => {
			const res = await apiClient.categories.$get();

			console.log(res);

			if (res.ok) {
				const data = await res.json();
				console.log(data);
				return data;
			}
			throw new Error(res.statusText);
		},
		enabled: false, // 手動で実行
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	return (
		<Button
			onClick={() => categoriesQuery.refetch()}
			disabled={categoriesQuery.isFetching}
			className="flex w-full items-center justify-center gap-2 rounded bg-gray-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{categoriesQuery.isFetching ? "取得中..." : "カテゴリ取得"}
		</Button>
	);
};

const PlacesButton: FC = () => {
	const placesQuery = useQuery({
		queryKey: ["places-debug"],
		queryFn: async () => {
			const res = await apiClient.places.$get();

			console.log(res);

			if (res.ok) {
				const data = await res.json();
				console.log(data);
				return data;
			}
			throw new Error(res.statusText);
		},
		enabled: false, // 手動で実行
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	return (
		<Button
			onClick={() => placesQuery.refetch()}
			disabled={placesQuery.isFetching}
			className="flex w-full items-center justify-center gap-2 rounded bg-gray-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{placesQuery.isFetching ? "取得中..." : "場所取得"}
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

// 商品名編集モーダル
const ItemNameEditModal: FC<{
	isOpen: boolean;
	onClose: () => void;
	item: Receipt["items"][0];
	onSave: (updatedItem: Receipt["items"][0]) => void;
}> = ({ isOpen, onClose, item, onSave }) => {
	const [editedItem, setEditedItem] = useState(item);

	const handleSave = () => {
		onSave(editedItem);
		onClose();
	};

	return (
		<Dialog open={isOpen} onClose={onClose} className="relative z-50">
			<div className="fixed inset-0 bg-black/25" />
			<div className="fixed inset-0 flex items-center justify-center p-2">
				<DialogPanel className="w-full max-w-sm rounded-lg bg-white p-4">
					<DialogTitle className="mb-3 font-bold text-base text-gray-900">
						商品名編集
					</DialogTitle>

					<div className="space-y-3">
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								商品名
							</Label>
							<textarea
								value={editedItem.normalizedName}
								onChange={(e) =>
									setEditedItem({
										...editedItem,
										normalizedName: e.target.value,
									})
								}
								rows={3}
								className="w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
								placeholder="商品名を入力してください"
							/>
						</Field>
						{editedItem.name !== editedItem.normalizedName && (
							<div className="rounded bg-yellow-50 p-2">
								<p className="text-xs text-yellow-700">
									<span className="font-medium">元の名前:</span>{" "}
									{editedItem.name}
								</p>
							</div>
						)}
					</div>

					<div className="mt-4 flex justify-end gap-2">
						<Button
							onClick={onClose}
							className="flex items-center gap-2 rounded bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600"
						>
							<X className="h-4 w-4" />
							キャンセル
						</Button>
						<Button
							onClick={handleSave}
							className="flex items-center gap-2 rounded bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600"
						>
							<Save className="h-4 w-4" />
							保存
						</Button>
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	);
};

const ExtractResultDisplay: FC<{
	result: Receipt;
	onClear: () => void;
	onUpdate?: (updatedResult: Receipt) => void;
}> = ({ result, onClear, onUpdate }) => {
	const [editableResult, setEditableResult] = useState<Receipt>(result);
	const [editingItem, setEditingItem] = useState<Receipt["items"][0] | null>(
		null,
	);
	const [editingIndex, setEditingIndex] = useState<number>(-1);
	const [shopNameQuery, setShopNameQuery] = useState("");

	// 店舗候補取得
	const placesQuery = useQuery({
		queryKey: ["places"],
		queryFn: async () => {
			const res = await apiClient.places.$get();
			if (res.ok) {
				const data = await res.json();
				if ("places" in data) {
					return data.places;
				}
				throw new Error("Invalid response format");
			}
			throw new Error(res.statusText);
		},
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	const places = placesQuery.data || [];

	// 店舗名のフィルタリング
	const filteredPlaces =
		shopNameQuery === ""
			? places
			: places.filter((place) =>
					place.name.toLowerCase().includes(shopNameQuery.toLowerCase()),
				);

	// 選択された店舗名を取得
	const selectedPlace = places.find(
		(place) => place.name === editableResult.shopName,
	);

	// 基本情報の更新
	const updateBasicInfo = (
		field: keyof Omit<Receipt, "items">,
		value: string | number,
	) => {
		const updated = { ...editableResult, [field]: value };
		setEditableResult(updated);
		if (onUpdate) {
			onUpdate(updated);
		}
	};

	// 商品項目の更新
	const updateItem = (
		index: number,
		field: keyof Receipt["items"][0],
		value: string | number,
	) => {
		const updatedItems = [...editableResult.items];
		updatedItems[index] = { ...updatedItems[index], [field]: value };
		const updated = { ...editableResult, items: updatedItems };
		setEditableResult(updated);
		if (onUpdate) {
			onUpdate(updated);
		}
	};

	// 商品項目の削除
	const removeItem = (index: number) => {
		const updatedItems = editableResult.items.filter((_, i) => i !== index);
		const updated = { ...editableResult, items: updatedItems };
		setEditableResult(updated);
		if (onUpdate) {
			onUpdate(updated);
		}
	};

	// 商品名編集モーダルを開く
	const openItemEdit = (item: Receipt["items"][0], index: number) => {
		setEditingItem(item);
		setEditingIndex(index);
	};

	// 商品名編集を保存
	const saveItemEdit = (updatedItem: Receipt["items"][0]) => {
		if (editingIndex >= 0) {
			const updatedItems = [...editableResult.items];
			updatedItems[editingIndex] = updatedItem;
			const updated = { ...editableResult, items: updatedItems };
			setEditableResult(updated);
			if (onUpdate) {
				onUpdate(updated);
			}
		}
		setEditingItem(null);
		setEditingIndex(-1);
	};

	return (
		<>
			<div className="w-full rounded-lg bg-white p-3 shadow-sm">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-bold text-base text-gray-800">抽出結果</h2>
					<Button
						onClick={onClear}
						className="flex items-center justify-center rounded bg-gray-200 px-2 py-1 text-gray-600 text-xs hover:bg-gray-300"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>

				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								購入日
							</Label>
							<Input
								type="date"
								value={editableResult.date}
								onChange={(e) => updateBasicInfo("date", e.target.value)}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						</Field>
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								店舗名
							</Label>
							<Combobox
								value={selectedPlace}
								onChange={(place: ZaimPlace | null) => {
									if (place) {
										updateBasicInfo("shopName", place.name);
									}
								}}
							>
								<div className="relative">
									<ComboboxInput
										className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
										displayValue={(place: ZaimPlace | null) =>
											place?.name ?? editableResult.shopName
										}
										onChange={(event) => setShopNameQuery(event.target.value)}
										placeholder="店舗名を選択してください"
									/>
									<ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
										<ChevronDown className="h-4 w-4 text-gray-400" />
									</ComboboxButton>
									<ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
										{filteredPlaces.map((place) => (
											<ComboboxOption
												key={place.uid}
												value={place}
												className="relative cursor-pointer select-none py-2 pr-4 pl-8 text-sm data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
											>
												{({ selected }) => (
													<>
														<span
															className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
														>
															{place.name}
														</span>
														{selected && (
															<span className="absolute inset-y-0 left-0 flex items-center pl-2">
																<Check className="h-4 w-4" />
															</span>
														)}
													</>
												)}
											</ComboboxOption>
										))}
										{filteredPlaces.length === 0 && shopNameQuery !== "" && (
											<div className="px-4 py-2 text-gray-500 text-sm">
												候補が見つかりません
											</div>
										)}
									</ComboboxOptions>
								</div>
							</Combobox>
						</Field>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<Field>
							<Label className="mb-1 block font-medium text-gray-600 text-xs">
								支払い方法
							</Label>
							<Input
								type="text"
								value={editableResult.paymentMethodName}
								onChange={(e) =>
									updateBasicInfo("paymentMethodName", e.target.value)
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
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
									updateBasicInfo("sumPrice", Number(e.target.value))
								}
								className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
							/>
						</Field>
					</div>

					<Disclosure>
						<DisclosureButton className="flex w-full justify-between rounded bg-gray-100 px-3 py-2 text-left font-medium text-gray-900 text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
							<span>商品一覧 ({editableResult.items.length}件)</span>
							<ChevronDown className="h-4 w-4" />
						</DisclosureButton>
						<DisclosurePanel className="mt-2 max-h-64 space-y-2 overflow-y-auto">
							{editableResult.items.map((item, index) => (
								<div
									key={`item-${index}-${item.name}`}
									className="rounded border bg-gray-50 p-2"
								>
									<div className="space-y-2">
										{/* 商品名とカテゴリの行 */}
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<button
													type="button"
													onClick={() => openItemEdit(item, index)}
													className="w-full text-left font-medium text-blue-600 text-sm hover:text-blue-800 hover:underline"
												>
													{item.normalizedName}
												</button>
												<p className="text-gray-600 text-xs">{item.category}</p>
											</div>
											<Button
												onClick={() => removeItem(index)}
												className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-white text-xs hover:bg-red-600"
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>

										{/* 金額と個数の行 */}
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-1">
												<span className="text-gray-600 text-xs">価格:</span>
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
													className="w-20 rounded border border-gray-300 px-1 py-0.5 text-right text-sm focus:border-blue-500 focus:outline-none"
												/>
												<span className="text-gray-600 text-xs">円</span>
											</div>
											<div className="flex items-center gap-1">
												<span className="text-gray-600 text-xs">数量:</span>
												<Input
													type="number"
													value={item.amount}
													onChange={(e) =>
														updateItem(index, "amount", Number(e.target.value))
													}
													className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-sm focus:border-blue-500 focus:outline-none"
												/>
												<span className="text-gray-600 text-xs">個</span>
											</div>
										</div>
									</div>
								</div>
							))}
						</DisclosurePanel>
					</Disclosure>
				</div>
			</div>

			{editingItem && (
				<ItemNameEditModal
					isOpen={editingItem !== null}
					onClose={() => {
						setEditingItem(null);
						setEditingIndex(-1);
					}}
					item={editingItem}
					onSave={saveItemEdit}
				/>
			)}
		</>
	);
};

export default App;
