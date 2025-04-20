import * as v from "valibot";
import type { Env } from "../../env";
import { type Result, err, ok } from "../../result";

export type ZaimRepository = {
	/**
	 * 一時的なリクエストトークンを保存する
	 */
	saveTemporalRequestToken: (
		data: {
			oauthToken: string;
			oauthTokenSecret: string;
			returnTo: string | null;
		},
		option: {
			expirationSeconds: number;
		},
	) => Promise<void>;

	/**
	 * 一時的なリクエストトークンを取得する
	 */
	readTemporalRequestToken: (
		oauthToken: string,
	) => Promise<
		Result<
			{ oauthToken: string; oauthTokenSecret: string; returnTo: string | null },
			ZaimRepositoryError<"NOT_FOUND">
		>
	>;

	/**
	 * 一時的なリクエストトークンを削除する
	 */
	expireTemporalRequestToken: (oauthToken: string) => Promise<void>;

	/**
	 * アクセストークンを保存する
	 */
	saveAccessToken: (data: {
		accessToken: string;
		accessTokenSecret: string;
	}) => Promise<void>;

	/**
	 * アクセストークンを取得する
	 */
	readAccessToken: () => Promise<
		Result<
			{ accessToken: string; accessTokenSecret: string },
			ZaimRepositoryError<"NOT_FOUND">
		>
	>;
};

export type ZaimRepositoryError<Code extends "NOT_FOUND"> = {
	code: Code;
	message: string;
	cause: unknown;
};

const temporalRequestTokenValueSchema = v.object({
	oauthTokenSecret: v.string(),
	returnTo: v.nullable(v.pipe(v.string(), v.url())),
});

const accessTokenValueSchema = v.object({
	accessToken: v.string(),
	accessTokenSecret: v.string(),
	updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

/**
 * zaimに関するデータを扱うRepositoryを取得する
 */
export const getZaimRepository = (env: Env, userId: string): ZaimRepository => {
	const getTemporalRequestTokenKey = (oauthToken: string) => {
		return `zaim-request-token:${userId}:${oauthToken}`;
	};

	const saveTemporalRequestToken: ZaimRepository["saveTemporalRequestToken"] =
		async (
			{ oauthToken, oauthTokenSecret, returnTo },
			{ expirationSeconds },
		) => {
			const kvKeyRequest = getTemporalRequestTokenKey(oauthToken);

			const serialized = JSON.stringify(
				v.parse(temporalRequestTokenValueSchema, {
					oauthTokenSecret,
					returnTo,
				}),
			);
			await env.ZAIM_AGENT_ZAIM_TOKENS_KV.put(kvKeyRequest, serialized, {
				expirationTtl: expirationSeconds,
			});
		};

	const readTemporalRequestToken: ZaimRepository["readTemporalRequestToken"] =
		async (oauthToken) => {
			const kvKeyRequest = getTemporalRequestTokenKey(oauthToken);

			const requestTokenRaw =
				await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKeyRequest);
			if (!requestTokenRaw) {
				return err({
					code: "NOT_FOUND",
					message: "Request token not found in KV.",
					cause: null,
				});
			}

			const json = JSON.parse(requestTokenRaw);
			const parsed = v.parse(temporalRequestTokenValueSchema, json);
			return ok({
				oauthToken,
				oauthTokenSecret: parsed.oauthTokenSecret,
				returnTo: parsed.returnTo,
			});
		};

	const expireTemporalRequestToken: ZaimRepository["expireTemporalRequestToken"] =
		async (oauthToken) => {
			const kvKeyRequest = getTemporalRequestTokenKey(oauthToken);

			await env.ZAIM_AGENT_ZAIM_TOKENS_KV.delete(kvKeyRequest);
		};

	const getAccessTokenKey = () => {
		return `zaim-access-token:${userId}`;
	};

	const saveAccessToken: ZaimRepository["saveAccessToken"] = async ({
		accessToken,
		accessTokenSecret,
	}) => {
		const kvKeyAccess = getAccessTokenKey();
		const updatedAt = new Date().toISOString();

		const serialized = JSON.stringify(
			v.parse(accessTokenValueSchema, {
				accessToken,
				accessTokenSecret,
				updatedAt,
			}),
		);
		await env.ZAIM_AGENT_ZAIM_TOKENS_KV.put(kvKeyAccess, serialized, {
			expirationTtl: 60 * 60 * 24 * 30, // 30 days
		});
	};

	const readAccessToken: ZaimRepository["readAccessToken"] = async () => {
		const kvKeyAccess = getAccessTokenKey();
		const accessTokenRaw = await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKeyAccess);
		if (!accessTokenRaw) {
			return err({
				code: "NOT_FOUND",
				message: "Access token not found in KV.",
				cause: null,
			});
		}
		const json = JSON.parse(accessTokenRaw);
		const parsed = v.parse(accessTokenValueSchema, json);
		return ok({
			accessToken: parsed.accessToken,
			accessTokenSecret: parsed.accessTokenSecret,
		});
	};

	return {
		saveTemporalRequestToken,
		readTemporalRequestToken,
		expireTemporalRequestToken,
		saveAccessToken,
		readAccessToken,
	};
};
