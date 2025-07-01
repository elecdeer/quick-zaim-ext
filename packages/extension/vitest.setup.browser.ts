import { fakeBrowser } from "@webext-core/fake-browser";
import { beforeEach, vi } from "vitest";
import "./entrypoints/sidepanel/style.css";

// webextension-polyfillをモック
vi.mock("webextension-polyfill");

// 各テスト前にfakeBrowserをリセット
beforeEach(() => {
	fakeBrowser.reset();

	// identity APIのモック設定（fakeBrowserに含まれていない）
	fakeBrowser.identity = {
		launchWebAuthFlow: vi.fn().mockResolvedValue("auth-success"),
	};
});
