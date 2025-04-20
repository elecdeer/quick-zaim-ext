import { Hono } from "hono";

import { HTTPException } from "hono/http-exception";
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
	.route("/zaim", zaimRoute)
	.onError((error, c) => {
		logger.error({
			type: "worker-error",
			error: {
				message: error.message,
				stack: error.stack,
				cause: error.cause,
			},
		});

		if (error instanceof HTTPException) {
			// Get the custom response
			return error.getResponse();
		}

		return c.json(
			{
				code: "internal_server_error",
				message: "Internal Server Error",
			},
			500,
		);
	});

export default app; // Cloudflare Workers 用のデフォルトエクスポート
