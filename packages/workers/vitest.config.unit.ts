import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		name: "workers",
		include: ["src/**/*.{test,spec}.{ts,js}"],
		exclude: ["node_modules/**", "dist/**"],
		testTimeout: 10000,
		hookTimeout: 10000,
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.toml" },
			},
		},
		setupFiles: ["./test-setup.ts"],
	},
});
