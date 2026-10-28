import { defineConfig } from "void/config";

export default defineConfig({
  head: {
    title: "台帳",
    titleTemplate: "%s | 台帳",
    htmlAttrs: { lang: "ja" },
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  },
  worker: {
    compatibility_date: "2026-04-13",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    name: "tsuke",
    // Void は Worker の公開設定がダッシュボード側の状態とずれているとデプロイを止めるので、今の値を明示する
    workers_dev: true,
    preview_urls: true,
    routes: [],
    observability: {
      logs: { enabled: true, invocation_logs: true },
    },
  },
});
