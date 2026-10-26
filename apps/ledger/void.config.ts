import { defineConfig } from "void/config";

export default defineConfig({
  worker: {
    compatibility_date: "2026-04-13",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    // 既存の quick-zaim-server とは別の Worker として作る（Zaim 連携を撤去するまで両方を動かすため）
    name: "quick-ledger",
    observability: {
      logs: { enabled: true, invocation_logs: true },
    },
    // ローカル開発には Access がないため、認証済みユーザー（dev@example.com）を再現する。
    // 未認証状態を試すときは dev ブロックを外す。
    access: {
      dev: {
        aud: "local-dev",
        identity: { email: "dev@example.com" },
      },
    },
  },
});
