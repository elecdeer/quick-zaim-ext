import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "extension",
		environment: "jsdom",
		include: ["**/*.{test,spec}.{ts,tsx}"],
		exclude: ["node_modules/**", "dist/**"],
		testTimeout: 10000,
		hookTimeout: 10000,
	},
});
