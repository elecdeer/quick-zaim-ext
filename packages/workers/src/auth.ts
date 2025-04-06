import {
	getAuth,
	oidcAuthMiddleware,
	processOAuthCallback,
	revokeSession,
} from "@hono/oidc-auth";
import { type Context, Hono, type Next } from "hono";
import { HTTPException } from "hono/http-exception";

export const authMiddleware = oidcAuthMiddleware();

export const authRoute = new Hono();

// OAuth コールバック
authRoute.get("/callback", (c: Context) => {
	return processOAuthCallback(c);
});

// ログイン処理: loginHandler を oidcAuth の前に実行
authRoute.get("/login", async (c: Context, next: Next) => {
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
});

// callbackとloginには適用しない
// https://github.com/honojs/middleware/issues/760#issuecomment-2520606683
authRoute.use("*", async (c, next) => {
	// 認証されていない場合に401を返す
	const auth = await getAuth(c);
	if (auth === null) {
		console.log("Unauthorized in authCheckMiddleware");
		throw new HTTPException(401, {
			message: "Unauthorized",
		});
	}
	await next();
});

// ログアウト
authRoute.get("/logout", async (c: Context) => {
	await revokeSession(c);
	return c.text("You have been successfully logged out!");
});

// TODO: そのうち消す
authRoute.use(authMiddleware).get("/hello", async (c) => {
	const auth = await getAuth(c); // getAuth を直接使用
	console.log("auth in /hello", auth);
	return c.text(`Hello <${auth?.email}>!`);
});
