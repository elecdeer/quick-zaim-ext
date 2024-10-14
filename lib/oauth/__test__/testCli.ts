import readline from "node:readline";
import { createOAuthApplicant, createOAuthSigner } from "../oauthClient";

const consumerKey = process.env.ZAIM_CONSUMER_KEY;
const consumerSecret = process.env.ZAIM_CONSUMER_SECRET;

const zaimOAuthEndpoints = {
	accessTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/access",
		method: "GET",
	},
	requestTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/request",
		method: "GET",
	},
	authorizeEndpoint: {
		url: "https://auth.zaim.net/users/auth",
	},
} as const;

const run = async () => {
	if (!consumerKey) {
		throw new Error("ZAIM_CONSUMER_KEY is not set");
	}
	if (!consumerSecret) {
		throw new Error("ZAIM_CONSUMER_SECRET is not set");
	}

	const { obtainAccessToken } = createOAuthApplicant({
		consumerKey,
		consumerSecret,
		...zaimOAuthEndpoints,
		waitUserAuthorize: (userAuthUrl) => {
			console.log("Please authorize the app at", userAuthUrl);
			// コンソール入力を受け付ける
			return new Promise((resolve) => {
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout,
				});
				rl.question("Enter the verifier code: ", (verifier) => {
					rl.close();
					resolve(verifier);
				});
			});
		},
	});

	const token = await obtainAccessToken();
	const req = new Request("https://api.zaim.net/v2/home/user/verify", {
		method: "GET",
	});
	const signer = createOAuthSigner({
		accessToken: token.accessToken,
		accessTokenSecret: token.accessTokenSecret,
		consumerKey,
		consumerSecret,
	});

	const authorizedRequest = await signer(req);
	const response = await fetch(authorizedRequest);
	console.log(await response.json());
};

run();
