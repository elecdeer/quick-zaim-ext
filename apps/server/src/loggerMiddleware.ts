import { getLogger } from "@logtape/logtape";
import type { Logger } from "@logtape/logtape";
import { createMiddleware } from "hono/factory";

export type { Logger };

export const loggerMiddleware = createMiddleware<{
  Variables: { logger: Logger };
}>(async (c, next) => {
  const requestId = crypto.randomUUID();
  const logger = getLogger(["quick-zaim", "server"]).with({
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  c.set("logger", logger);

  logger.debug("<-- {method} {path}");

  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  logger.with({ status: c.res.status, duration }).info("--> {method} {path} {status} {duration}ms");
});
