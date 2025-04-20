import { type Client, createClient } from "@hey-api/client-fetch";
import { createOAuthSigner } from "@repo/oauth";
import * as logger from "../../logger";

/**
 * Zaim API Clientを作成する
 */
export const createZaimClient = ({
	accessToken,
	accessTokenSecret,
	consumerKey,
	consumerSecret,
}: {
	accessToken: string;
	accessTokenSecret: string;
	consumerKey: string;
	consumerSecret: string;
}): Client => {
	const signer = createOAuthSigner({
		accessToken,
		accessTokenSecret,
		consumerKey,
		consumerSecret,
	});

	const client = createClient({
		baseUrl: "https://api.zaim.net/",
	});

	client.interceptors.request.use(loggingRequestInterceptor);
	client.interceptors.request.use(signer);

	client.interceptors.response.use(loggingResponseInterceptor);

	return client;
};

const loggingRequestInterceptor = (req: Request) => {
	logger.info({
		type: "zaim-api-request",
		method: req.method,
		url: req.url,
	});
	return req;
};

const loggingResponseInterceptor = async (res: Response) => {
	const clonedRes = res.clone();
	const contentType = res.headers.get("content-type") || "";

	try {
		if (contentType.includes("application/json")) {
			const data = await clonedRes.json();
			logger.info({
				type: "zaim-api-response",
				url: res.url,
				status: res.status,
				statusText: res.statusText,
				contentType,
				body: data,
			});
		}

		if (contentType.includes("text/")) {
			const text = await clonedRes.text();
			logger.info({
				type: "zaim-api-response",
				url: res.url,
				status: res.status,
				statusText: res.statusText,
				contentType,
				body: text,
			});
		}
	} catch (e: unknown) {
		logger.error({
			type: "zaim-api-response-parse-error",
			message: "Failed to parse Zaim API response",
			contentType,
			url: res.url,
			status: res.status,
			statusText: res.statusText,
			error: e instanceof Error ? e.message : String(e),
		});
	}

	return res;
};
