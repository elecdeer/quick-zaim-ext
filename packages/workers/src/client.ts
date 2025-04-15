import { hc } from "hono/client";

import type { ExtractionRouteType } from "./handlers/extraction";
import type { ZaimRouteType } from "./handlers/zaim";

export const createZaimApiClient = (baseUrl: string) => {
	const url = new URL("/zaim", baseUrl);
	return hc<ZaimRouteType>(url.toString());
};

export const createExtractionApiClient = (baseUrl: string) => {
	const url = new URL("/extraction", baseUrl);
	return hc<ExtractionRouteType>(url.toString());
};
