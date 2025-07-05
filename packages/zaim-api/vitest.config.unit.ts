import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "zaim-api",
		environment: "node",
		include: ["src/**/*.{test,spec}.{ts,js}"],
		exclude: ["node_modules/**", "dist/**", "tsp-output/**"],
		testTimeout: 10000,
		hookTimeout: 10000,
	},
});
