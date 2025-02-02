import OpenAI from "openai";
import { useCallback } from "react";
import { browser } from "wxt/browser";

import "./App.css";

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
			const extractResult = await extractByOpenAI(res.result);
			console.log(extractResult);
		}
	}, []);

	return (
		<div className="card">
			<button type="button" onClick={handleClick}>
				Extract
			</button>
			<button
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
			</button>
			<button
				type="button"
				onClick={async () => {
					const url = new URL("http://localhost:8787/hello");

					try {
						const res = await fetch(url, {
							method: "GET",
						});

						if (res.ok) {
							const text = await res.text();
							console.log("res", text);
						} else {
							console.warn("res not ok", res);

							console.warn("redirected", res.redirected);
							console.warn("status", res.status);
							console.warn("statusText", res.statusText);
							console.warn("url", res.url);
						}
					} catch (e) {
						console.warn("catch", e);

						if (e instanceof TypeError) {
							console.warn("TypeError", e.message);
						}
					}
				}}
			>
				Hello
			</button>

			<button
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
			</button>
		</div>
	);
}

const extractByOpenAI = async (pageHtml: string) => {
	const apiKey = localStorage.getItem("openai-api-key");
	if (!apiKey) {
		console.warn("OpenAI API key is not set");
		return;
	}

	const openai = new OpenAI({
		apiKey,
		// TODO:; 後でサーバ側に移動してこれを外す
		dangerouslyAllowBrowser: true,
	});

	const response = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages: [
			{
				role: "system",
				content: [
					{
						text: "入力の請求書の情報を読み取り出力してください。\n割引についてもitemの1つとして扱ってください。\nsumPriceが各itemのpriceYen x amountの合計になるように確認してください。",
						type: "text",
					},
				],
			},
			{
				role: "user",
				content: [
					{
						text: pageHtml,
						type: "text",
					},
				],
			},
		],
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "receipt",
				schema: {
					type: "object",
					required: ["shopName", "date", "sumPrice", "receiptId", "items"],
					properties: {
						date: {
							type: "string",
							description: "YYYY-MM-DD形式の購入日",
						},
						items: {
							type: "array",
							items: {
								type: "object",
								required: ["name", "category", "priceYen", "amount"],
								properties: {
									name: {
										type: "string",
										description: "商品名",
									},
									amount: {
										type: "integer",
										description: "商品の個数",
									},
									category: {
										type: "string",
										description: "商品のカテゴリ",
									},
									priceYen: {
										type: "integer",
										description: "商品の金額",
									},
								},
								additionalProperties: false,
							},
							description: "A list of items purchased in the transaction.",
						},
						shopName: {
							type: "string",
							description: "購入した店舗やサイトの名前",
						},
						sumPrice: {
							type: "integer",
							description: "The total price of all items on the receipt.",
						},
						receiptId: {
							type: "string",
							description: "A unique identifier for the receipt.",
						},
					},
					additionalProperties: false,
				},
				strict: true,
			},
		},
		temperature: 1,
		max_completion_tokens: 2048,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0,
	});

	console.log(response);

	const resultRaw = response.choices[0].message.content;

	console.log(resultRaw);
	if (!resultRaw) {
		return null;
	}

	return JSON.parse(resultRaw);
};

export default App;
