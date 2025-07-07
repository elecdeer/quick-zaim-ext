import { createAsyncObjectStack } from "async-object-stack";
import { createFactory } from "hono/factory";

const stack = createAsyncObjectStack();

type Logger = (context: object) => void;

const createLeveledLogger = (level: string) => {
	const logger: Logger = (context) => {
		console.log({
			level,
			...stack.render(),
			...context,
		});
	};

	return logger;
};

/**
 * 今のリクエストコンテキストにメタデータを追加する
 */
export const metadata = (meta: Record<string, unknown>) => {
	return stack.push(meta);
};

export const debug = createLeveledLogger("DEBUG");
export const info = createLeveledLogger("INFO");
export const warn = createLeveledLogger("WARN");
export const error = createLeveledLogger("ERROR");

const factory = createFactory();
export const middleware = factory.createMiddleware(async (c, next) => {
	const { method, url } = c.req;

	// https://を取る
	const path = url.slice(url.indexOf("/", 8));
	info({
		type: "workers-request",
		method,
		path,
	});

	const start = Date.now();

	await stack.region(async () => {
		await next();
	});

	const end = Date.now();
	const duration = end - start;

	c.res
		.clone()
		.json()
		.then((json) => {
			info({
				type: "workers-response",
				method,
				path,
				status: c.res.status,
				timeMs: duration,
				res: json,
			});
		});
});
