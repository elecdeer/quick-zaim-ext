import { Hono } from "hono";
import { authMiddleware, authRoute } from "./auth"; // auth.ts から authApp をデフォルトインポート
import { validateEnvMiddleware } from "./env";
import { extractionHtmlRoute } from "./handlers/extraction/html";
import { zaimRoute } from "./handlers/zaim";
import * as logger from "./logger";
import type { HonoApp } from "./workers";

const app = new Hono<HonoApp>();

app.use(validateEnvMiddleware);
app.use(logger.middleware);

app.use("*", authMiddleware);

// authApp をルートにマウント
app.route("/", authRoute);

app.route("/extraction/html", extractionHtmlRoute);

app.route("/zaim", zaimRoute);

export default app;
