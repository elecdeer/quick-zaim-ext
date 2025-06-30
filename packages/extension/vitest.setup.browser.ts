import { vi } from "vitest";
import "./entrypoints/sidepanel/style.css";

// wxt/browserモジュールをモック
vi.mock("wxt/browser", () => ({
	browser: {
		identity: {
			launchWebAuthFlow: vi.fn().mockResolvedValue("auth-success"),
		},
	},
}));
