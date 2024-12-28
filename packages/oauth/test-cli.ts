import readline from "node:readline";
import {
	accountGetAccounts,
	categoryGetCategories,
	client,
	genreGetGenres,
	moneyGetMoney,
	paymentOperationsCreate,
	userVerifyUser,
} from "@repo/zaim-api/client";
import { createOAuthApplicant, createOAuthSigner } from "./src/oauthClient";

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

	const signer = createOAuthSigner({
		accessToken: token.accessToken,
		accessTokenSecret: token.accessTokenSecret,
		consumerKey,
		consumerSecret,
	});

	client.setConfig({
		baseUrl: "https://api.zaim.net/",
	});
	client.interceptors.request.use((req) => {
		console.log(req.url);
		return signer(req);
	});

	const res = await userVerifyUser();
	console.log(res.data ?? res.error);

	// const res2 = await paymentOperationsCreate({
	// 	query: {
	// 		mapping: 1,
	// 		category_id: 101,
	// 		genre_id: 10101,
	// 		amount: 10,
	// 		from_account_id: 0,
	// 		date: "2024-01-07",
	// 		receipt_id: Date.now(),
	// 		name: "テスト テスト",
	// 		// place: "place0000000",
	// 		place_uid: "zm-d520b7deef518000",
	// 		comment: "",
	// 	},
	// });
	// console.log(res2.data ?? res2.error);

	const res3 = await categoryGetCategories({
		query: {
			mapping: 1,
			page: 1,
		},
	});
	console.log(res3.data ?? res3.error);

	// const categoryReq = new Request("https://api.zaim.net/v2/home/category", {
	// 	method: "GET",
	// });
	// const category = await fetch(await signer(categoryReq));
	// console.log(await category.json());

	const res4 = await accountGetAccounts({
		query: {
			mapping: 1,
			page: 1,
		},
	});
	console.log(res4.data ?? res4.error);

	const res5 = await genreGetGenres({
		query: {
			mapping: 1,
			page: 1,
		},
	});
	console.log(res5.data ?? res5.error);

	const res6 = await moneyGetMoney({
		query: {
			mapping: 1,
			page: 1,
		},
	});
	console.log(res6.data ?? res6.error);
};

run();
