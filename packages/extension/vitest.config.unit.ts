import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "extension-unit",
		environment: "node",
		include: ["src/**/*.test.ts", "entrypoints/**/*.test.ts"],
		exclude: ["node_modules/**", "dist/**"],
		testTimeout: 10000,
		hookTimeout: 10000,
		pool: "forks",
	},
});
