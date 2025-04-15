import {
	getAuth,
	oidcAuthMiddleware,
	processOAuthCallback,
	revokeSession,
} from "@hono/oidc-auth";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as logger from "./logger";
import { assertNonNullable } from "./utils";

export const authMiddleware = oidcAuthMiddleware();

export const authRoute = new Hono()
	.get("/callback", (c) => {
		// OAuth コールバック
		return processOAuthCallback(c);
	})
	.get("/login", async (c, next) => {
		// ログイン処理: loginHandler を oidcAuth の前に実行
		console.log("/login endpoint in auth.ts");
		const urlAfterLogin = c.req.query("return-to");
		console.log("urlAfterLogin", urlAfterLogin);

		const auth = await getAuth(c);
		console.log("auth", auth);
		if (urlAfterLogin !== undefined && auth !== null) {
			// oidcAuthMiddlewareでの認証後に遷移する先
			return c.redirect(urlAfterLogin);
		}

		// 未認証の場合や return-to がない場合は oidcAuthMiddleware にフォールスルーさせる
		await next();
	})
	.use("*", async (c, next) => {
		// callbackとloginには適用しない
		// https://github.com/honojs/middleware/issues/760#issuecomment-2520606683

		// 認証されていない場合に401を返す
		const auth = await getAuth(c);
		if (auth === null) {
			console.log("Unauthorized in authCheckMiddleware");
			throw new HTTPException(401, {
				message: "Unauthorized",
			});
		}

		await next();
	})
	.get("/logout", async (c) => {
		// ログアウト
		await revokeSession(c);
		return c.text("You have been successfully logged out!");
	})
	.get("/user", (c) => {
		const auth = c.var.oidcAuth;
		assertNonNullable(auth);

		return c.json({
			email: auth.email,
			sub: auth.sub,
		});
	});

// TODO: そのうち消す
authRoute.use(authMiddleware).get("/hello", async (c) => {
	logger.info({
		env: c.env,
	});
	const auth = await getAuth(c); // getAuth を直接使用
	console.log("auth in /hello", auth);
	return c.text(`Hello <${auth?.email}>!`);
});
