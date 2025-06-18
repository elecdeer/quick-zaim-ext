import {
	createExtractionApiClient,
	createZaimApiClient,
} from "@repo/workers/client";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { type FC, useCallback } from "react";
import { browser } from "wxt/browser";

// TODO: 環境変数などからベース URL を取得するようにする
const apiClient = createZaimApiClient("http://localhost:8787");
const extractionClient = createExtractionApiClient("http://localhost:8787");

function App() {
	const handleClick = useCallback(async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		const tab = tabs[0];

		console.log("activeTab", tab);
		if (!tab || !tab.id) return;

		const [res] = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			files: ["content-scripts/extract.js"],
		});
		console.log(res);

		if (res.result) {
			try {
				// 生成した API クライアントを使用
				const response = await extractionClient.index.$post({
					json: {
						ariaSnapshot: res.result as string,
					},
				});

				if (!response.ok) {
					// エラーレスポンスの処理
					console.error("Extraction failed:", await response.text());
					// 必要に応じてユーザーにエラーを通知
					return;
				}

				// 成功時の処理 (必要であればレスポンスボディを使用)
				const data = await response.json();
				console.log("Extraction successful:", data);
			} catch (error) {
				// ネットワークエラーなどの処理
				console.error("Error during extraction request:", error);
				// 必要に応じてユーザーにエラーを通知
			}
		}
	}, []);

	return (
		<div className="flex h-screen w-full flex-col items-center justify-start gap-4 bg-gray-100 p-4">
			<h1 className="text-xl font-bold">Quick Zaim Extension</h1>
			<Button className="" onClick={handleClick}>
				Extract
			</Button>
			<Button
				type="button"
				onClick={async () => {
					const url = new URL("http://localhost:8787/login");
					url.searchParams.set(
						"return-to",
						"https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org",
					);

					const res = await browser.identity.launchWebAuthFlow({
						interactive: true,
						url: url.toString(),
					});
					console.log(res);
				}}
			>
				Login
			</Button>
			<Button
				type="button"
				onClick={async () => {
					const res = await apiClient.login.$post({
						query: {
							"return-to":
								"https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org",
						},
					});
					const { userAuthorizeUrl } = await res.json();

					console.log({ userAuthorizeUrl });

					// http://localhost:8787/zaim/callback からのリダイレクト先を https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org にしないといけない
					const res2 = await browser.identity.launchWebAuthFlow({
						interactive: true,
						url: userAuthorizeUrl,
					});
					console.log(res2);
				}}
			>
				Zaim Login
			</Button>
			<Button
				type="button"
				onClick={async () => {
					const res = await apiClient.categories.$get();

					console.log(res);

					if (res.ok) {
						const data = await res.json();
						console.log(data);
					} else {
						console.error("Error:", res.statusText);
					}
				}}
			>
				Hello
			</Button>

			<Button
				type="button"
				onClick={async () => {
					const res = await apiClient.places.$get();

					console.log(res);

					if (res.ok) {
						const data = await res.json();
						console.log(data);
					} else {
						console.error("Error:", res.statusText);
					}
				}}
			>
				Places
			</Button>

			<Button
				type="button"
				onClick={async () => {
					const url = new URL("http://localhost:8787/logout");
					const res = await fetch(url, {
						method: "GET",
					});
					console.log(res);
				}}
			>
				Logout
			</Button>
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
				"w-24 rounded bg-blue-500 px-4 py-2 text-white hover:cursor-pointer hover:bg-blue-900 active:translate-y-0.5",
				className,
			)}
			type="button"
			{...props}
		/>
	);
};

export default App;