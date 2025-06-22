import { hc } from "hono/client";

import type { ExtractionRouteType } from "./handlers/extraction";
import type { ZaimRouteType } from "./handlers/zaim";

// Re-export types for client usage
export type {
	Category,
	PaymentMethod,
	Receipt,
	Shop,
	SubCategory,
} from "./services/agent/extraction/extractFromA11yTree";

export type { ZaimPlace } from "./services/zaim/types";

export const createZaimApiClient = (baseUrl: string) => {
	const url = new URL("/zaim", baseUrl);
	return hc<ZaimRouteType>(url.toString());
};

export const createExtractionApiClient = (baseUrl: string) => {
	const url = new URL("/extraction", baseUrl);
	return hc<ExtractionRouteType>(url.toString());
};
