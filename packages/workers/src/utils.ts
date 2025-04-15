import { HTTPException } from "hono/http-exception";
import * as logger from "./logger";

export function assertNonNullable<T>(
	value: T,
): asserts value is NonNullable<T> {
	if (value === null || value === undefined) {
		logger.error({
			message: "value is null or undefined",
		});
		throw new HTTPException(500, {
			message: "Internal Server Error",
		});
	}
}
