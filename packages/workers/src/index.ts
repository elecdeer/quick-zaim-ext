import { Hono } from "hono";

import { extractionHtmlRoute } from "./handlers/extraction/html";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.route("/extraction/html", extractionHtmlRoute);

export default app;
