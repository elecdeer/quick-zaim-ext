import {
	Button,
	Disclosure,
	DisclosureButton,
	DisclosurePanel,
} from "@headlessui/react";
import type { Receipt } from "@repo/workers/client";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { ScanLine, Settings } from "lucide-react";
import { type FC, useCallback } from "react";
import { browser } from "wxt/browser";
import {
	CategoriesButton,
	LoginButton,
	LogoutButton,
	PlacesButton,
	ZaimLoginButton,
} from "./components/AuthButtons";
import { ExtractResultDisplay } from "./components/ExtractResultDisplay";
import { useReceiptState } from "./hooks/useReceiptState";
import { extractionClient, queryClient } from "./lib/api";

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<MainContent />
		</QueryClientProvider>
	);
}

function MainContent() {
	// Receipt状態管理フック
	const receiptState = useReceiptState();

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
			receiptState.setExtractResult(data);
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

					<AuthSettingsPanel />

					{receiptState.state.orderNo && (
						<ExtractResultDisplay
							receiptState={receiptState}
							onClear={() => {
								receiptState.setExtractResult({
									date: "",
									items: [],
									shopName: "",
									shopId: null,
									paymentMethodName: "",
									paymentMethodId: "",
									sumPrice: 0,
									orderNo: "",
								});
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

const AuthSettingsPanel: FC = () => {
	return (
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
	);
};

export default App;
