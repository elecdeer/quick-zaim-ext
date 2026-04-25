import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  browser: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Quick Zaim",
    description: "Zaimへの支出を素早く記録するChrome拡張機能",
    permissions: ["storage", "sidePanel", "tabs", "identity"],
    host_permissions: ["<all_urls>"],
    action: {},
    side_panel: {
      default_path: "sidepanel/index.html",
    },
  },
  vite: () =>
    ({
      plugins: [tailwindcss()],
    }) as any,
});
