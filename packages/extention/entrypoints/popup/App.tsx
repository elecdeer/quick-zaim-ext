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

	const handleAT = useCallback(async () => {
		// @ts-expect-error
		console.log(chrome.debugger);

		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		const tab = tabs[0];

		console.log("activeTab", tab);
		if (!tab || !tab.id) return;

		console.log("tabId", tab.id);

		// @ts-expect-error
		chrome.debugger.attach({ tabId: tab.id }, "1.3", () => {
			// @ts-expect-error
			chrome.debugger.sendCommand(
				{ tabId: tab.id },
				"Accessibility.enable",
				{},
				(result) => {
					console.log("done", result);

					// @ts-expect-error
					if (chrome.runtime.lastError) {
						// @ts-expect-error
						console.error(chrome.runtime.lastError);
					}
				},
			);

			type AXNode = {
				nodeId: string;
				parentId: string;
				name:
					| {
							type: string;
							value: string;
					  }
					| undefined;
				role:
					| {
							type: string;
							value: string;
					  }
					| undefined;
			};

			type AXNodeTree = {
				nodeId: string;
				parentId: string;
				name: {
					type: string | undefined;
					value: string | undefined;
				};
				role: {
					type: string | undefined;
					value: string | undefined;
				};
				children: AXNodeTree[];
			};

			// @ts-expect-error
			chrome.debugger.sendCommand(
				{ tabId: tab.id },
				"Accessibility.getFullAXTree",
				{},
				({
					nodes,
				}: {
					nodes: AXNode[];
				}) => {
					console.log("done", nodes);

					// make tree

					const pickNode = (node: AXNode): AXNodeTree => {
						return {
							nodeId: node.nodeId,
							parentId: node.parentId,
							name: {
								type: node.name?.type,
								value: node.name?.value,
							},
							role: {
								type: node.role?.type,
								value: node.role?.value,
							},
							children: [],
						};
					};

					const treeRoot = pickNode(nodes[0]);

					const makeTree = (node: AXNodeTree, nodes: AXNode[]) => {
						for (const n of nodes) {
							if (n.parentId === node.nodeId) {
								const child = pickNode(n);
								node.children.push(child);
								makeTree(child, nodes);
							}
						}
						return node;
					};

					console.log(makeTree(treeRoot, nodes));

					// @ts-expect-error
					if (chrome.runtime.lastError) {
						// @ts-expect-error
						console.error(chrome.runtime.lastError);
					}

					// detach
					// @ts-expect-error
					chrome.debugger.detach({ tabId: tab.id }, () => {
						console.log("detached");
					});
				},
			);
		});

		// @ts-expect-error
		chrome.debugger.onEvent.addListener((source, method, params) => {
			if (method === "Network.responseReceived") {
				console.log("Response received:", params.response);
				// Perform your desired action with the response data
			}
		});
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

			<button type="button" onClick={handleAT}>
				cdp
			</button>
		</div>
	);
}

export default App;
