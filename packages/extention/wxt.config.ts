import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	manifest: {
		permissions: [
			"storage",
			"activeTab",
			"scripting",
			"identity",
			"debugger",
			"sidePanel",
		],
		// TODO: 開発中はこれでよいが、そのうち見直す必要がある
		host_permissions: ["file:///*", "http://localhost/*", "https://*/*"],
		action: {
			default_title: "Quick Zaim Extension",
		},
		side_panel: {
			default_path: "sidepanel.html",
		},
	},
	imports: false,
	vite: () => ({
		plugins: [tailwindcss()],
	}),
});
