import {
	getAuth,
	oidcAuthMiddleware,
	processOAuthCallback,
	revokeSession,
} from "@hono/oidc-auth";
import { Hono } from "hono";

import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { extractionHtmlRoute } from "./handlers/extraction/html";

const app = new Hono();

app.get("/callback", (c) => {
	return processOAuthCallback(c);
});

// https://github.com/honojs/middleware/issues/760#issuecomment-2520606683
app.use(
	createMiddleware(async (c, next) => {
		console.log("c.req.path", c.req.path);

		// /login以外のパスでは認証されていない場合に401を返す
		if (c.req.path !== "/login") {
			const auth = await getAuth(c);
			if (auth === null) {
				console.log("Unauthorized");
				throw new HTTPException(401, {
					message: "Unauthorized",
				});
			}
		}

		await next();
	}),
);

app.get("/login", async (c, next) => {
	console.log("/login endpoint");
	const urlAfterLogin = c.req.query("return-to");
	console.log("urlAfterLogin", urlAfterLogin);

	const auth = await getAuth(c);
	console.log("auth", auth);
	if (urlAfterLogin !== undefined && auth !== null) {
		// oidcAuthMiddlewareでの認証後に遷移する先
		return c.redirect(urlAfterLogin);
	}

	await next();
});

app.get("/logout", async (c) => {
	await revokeSession(c);
	return c.text("You have been successfully logged out!");
});

app.use(oidcAuthMiddleware());

app.get("/hello", async (c) => {
	const auth = await getAuth(c);
	return c.text(`Hello <${auth?.email}>!`);
});

app.route("/extraction/html", extractionHtmlRoute);

export default app;
