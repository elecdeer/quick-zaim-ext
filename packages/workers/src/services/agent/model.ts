import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { Env } from "../../env";
import * as logger from "../../logger";

export const getLanguageModel = async (env: Env): Promise<LanguageModel> => {
	const gatewayUrl =
		await env.AI.gateway("receipt-test").getUrl("google-ai-studio");
	logger.debug({
		message: "Gateway URL",
		gatewayUrl,
	});
	const google = createGoogleGenerativeAI({
		apiKey: env.GEMINI_API_KEY,
		baseURL: `${gatewayUrl}/v1beta`,
	});

	return google("gemini-2.0-flash-001");
};
