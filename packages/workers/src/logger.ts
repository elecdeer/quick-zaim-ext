import { createFactory } from "hono/factory";

type Logger = (context: object) => void;

const createLeveledLogger = (level: string) => {
	const logger: Logger = (context) => {
		console.log({
			level,
			...context,
		});
	};

	return logger;
};

export const info = createLeveledLogger("INFO");
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

	await next();

	const end = Date.now();
	const duration = end - start;

	info({
		type: "workers-response",
		method,
		path,
		status: c.res.status,
		timeMs: duration,
	});
});
