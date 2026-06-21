import { test as testBase } from "vitest";
import { getWorker } from "msw-storybook-addon";
import { resetAllQueries } from "../queries";

/**
 * MSW worker の自動リセットとクエリキャッシュのリセットを含む拡張 test。
 * auto: true により全テストでハンドラーとキャッシュがリセットされる。
 */
export const test = testBase.extend<{ worker: ReturnType<typeof getWorker> }>({
  worker: [
    async ({ task: _task }, use) => {
      await use(getWorker());
      getWorker().resetHandlers();
      resetAllQueries();
    },
    { auto: true },
  ],
});
