import { Hono } from "hono";

import { authMiddleware, authRoute } from "./auth";
import { validateEnvMiddleware } from "./env";
import { extractionRoute } from "./handlers/extraction";
import { zaimRoute } from "./handlers/zaim";
import * as logger from "./logger";
import type { HonoApp } from "./workers";

export type AppType = typeof app;

const app = new Hono<HonoApp>()
	.use(validateEnvMiddleware)
	.use(logger.middleware)
	.use(authMiddleware)
	.route("/", authRoute)
	.route("/extraction", extractionRoute)
	.route("/zaim", zaimRoute);

export default app; // Cloudflare Workers 用のデフォルトエクスポート
