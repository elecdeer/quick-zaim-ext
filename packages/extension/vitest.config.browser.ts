import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [react()],
	test: {
		name: "extension-browser",
		include: [
			"src/**/*.test.browser.ts(x)",
			"entrypoints/**/*.test.browser.ts(x)",
		],
		browser: {
			provider: "playwright",
			enabled: true,
			ui: false,
			instances: [{ browser: "chromium" }],
		},
	},
});
