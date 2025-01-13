import reactLogo from "@/assets/react.svg";
import { useCallback, useState } from "react";
import wxtLogo from "/wxt.svg";
import "./App.css";
import { browser } from "wxt/browser";

function App() {
	const [count, setCount] = useState(0);

	const handleClick = useCallback(async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		const tab = tabs[0];

		console.log("activeTab", tab);
		if (!tab || !tab.id) return;

		const res = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			files: ["content-scripts/extract.js"],
		});
		console.log(res);
	}, []);

	return (
		<>
			<div>
				<a href="https://wxt.dev" target="_blank" rel="noreferrer">
					<img src={wxtLogo} className="logo" alt="WXT logo" />
				</a>
				<a href="https://react.dev" target="_blank" rel="noreferrer">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1>WXT + React</h1>
			<div className="card">
				<button type="button" onClick={handleClick}>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<p className="read-the-docs">
				Click on the WXT and React logos to learn more
			</p>
		</>
	);
}

export default App;
