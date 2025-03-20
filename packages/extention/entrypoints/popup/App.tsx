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
			const url = new URL("http://localhost:8787/extraction/html");
			const response = await fetch(url, {
				method: "POST",
				body: JSON.stringify({
					html: res.result,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			});

			console.log(response);
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
					const url = new URL("http://localhost:8787/zaim/login");
					url.searchParams.set(
						"callback",
						"http://localhost:8787/zaim/callback",
					);

					const res = await fetch(url, {
						method: "GET",
					});

					const { userAuthorizeUrl } = await res.json();

					console.log({ userAuthorizeUrl });

					// http://localhost:8787/zaim/callbackからのリダイレクト先をhttps://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.orgにしないといけない
					const res2 = await browser.identity.launchWebAuthFlow({
						interactive: true,
						url: userAuthorizeUrl,
					});
					console.log(res2);
				}}
			>
				Zaim Login
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

export default App;
