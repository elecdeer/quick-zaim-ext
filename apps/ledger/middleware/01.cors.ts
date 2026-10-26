import { cors } from "hono/cors";
import { defineMiddleware } from "void";

/**
 * 拡張機能（chrome-extension://）とローカル開発からのクロスオリジンリクエストを許可する。
 * 拡張機能は Access のセッション Cookie を送るので credentials を許可する。
 */
export default defineMiddleware(
  cors({
    origin: (origin) => {
      if (
        origin.startsWith("chrome-extension://") ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1")
      ) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);
