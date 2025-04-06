import { Hono } from "hono";
import { authMiddleware, authRoute } from "./auth"; // auth.ts から authApp をデフォルトインポート
import { extractionHtmlRoute } from "./handlers/extraction/html";
import { zaimRoute } from "./handlers/zaim";
import * as logger from "./logger";
// createMiddleware と HTTPException は auth.ts に移動したので削除

const app = new Hono();

app.use(logger.middleware);

app.use("*", authMiddleware);

// authApp をルートにマウント
app.route("/", authRoute);

app.route("/extraction/html", extractionHtmlRoute);

app.route("/zaim", zaimRoute);

export default app;
