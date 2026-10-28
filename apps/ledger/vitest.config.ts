import { defineProject } from "vite-plus";

// vite.config.ts は voidPlugin を読み込むため、単体テストは別の設定で動かす
export default defineProject({
  test: {
    name: "ledger/unit",
    environment: "node",
  },
});
