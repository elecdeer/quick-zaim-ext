import { vi } from "vitest";

// wxt/browserモジュールをモック
vi.mock("wxt/browser", () => ({
	browser: {
		identity: {
			launchWebAuthFlow: vi.fn().mockResolvedValue("auth-success"),
		},
	},
}));
