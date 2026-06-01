import { test as testBase } from "vitest";
import { getWorker } from "msw-storybook-addon";

/**
 * MSW worker の自動リセットを含む拡張 test。
 * auto: true により全テストでハンドラーがリセットされる。
 */
export const test = testBase.extend<{ worker: ReturnType<typeof getWorker> }>({
  worker: [
    async ({ task: _task }, use) => {
      await use(getWorker());
      getWorker().resetHandlers();
    },
    { auto: true },
  ],
});
