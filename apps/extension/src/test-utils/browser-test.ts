import { test as testBase } from "vite-plus/test";
import { getWorker } from "msw-storybook-addon";
import { cleanup } from "vitest-browser-react";
import { resetAllQueries } from "../queries";

/**
 * MSW worker の自動リセットとクエリキャッシュのリセットを含む拡張 test。
 * auto: true により全テストでハンドラーとキャッシュがリセットされる。
 */
export const test = testBase.extend<{ worker: ReturnType<typeof getWorker> }>({
  worker: [
    async ({ task: _task }, use) => {
      await use(getWorker());
      // 画面が残ったままキャッシュを消すと、残った画面がこのテストのストレージから読み直して
      // キャッシュに戻し、次のテストに漏れる。先にアンマウントしてから消す
      await cleanup();
      getWorker().resetHandlers();
      resetAllQueries();
    },
    { auto: true },
  ],
});
