import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { type AccessToken, type RequestToken, accessTokens, requestTokens } from "./schema";

// D1データベースへの接続を作成する関数
export const createDb = (d1: D1Database) => {
	return drizzle(d1);
};

// RequestTokenの保存と取得のためのユーティリティ関数
export const requestTokenRepository = {
	// RequestTokenを保存する
	async saveRequestToken(
		db: ReturnType<typeof createDb>,
		token: RequestToken,
	): Promise<void> {
		await db
			.insert(requestTokens)
			.values({
				oauthToken: token.oauthToken,
				oauthTokenSecret: token.oauthTokenSecret,
			})
			.onConflictDoUpdate({
				target: requestTokens.oauthToken,
				set: {
					oauthTokenSecret: token.oauthTokenSecret,
					createdAt: new Date().toISOString(),
				},
			});
	},

	// RequestTokenを取得する
	async getRequestToken(
		db: ReturnType<typeof createDb>,
		oauthToken: string,
	): Promise<RequestToken | null> {
		const result = await db
			.select({
				oauthToken: requestTokens.oauthToken,
				oauthTokenSecret: requestTokens.oauthTokenSecret,
			})
			.from(requestTokens)
			.where(eq(requestTokens.oauthToken, oauthToken))
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		return result[0];
	},

	// RequestTokenを削除する
	async deleteRequestToken(
		db: ReturnType<typeof createDb>,
		oauthToken: string,
	): Promise<void> {
		await db
			.delete(requestTokens)
			.where(eq(requestTokens.oauthToken, oauthToken));
	},
};

// AccessTokenの保存と取得のためのユーティリティ関数
export const accessTokenRepository = {
	// AccessTokenを保存する
	async saveAccessToken(
		db: ReturnType<typeof createDb>,
		token: AccessToken,
	): Promise<void> {
		const now = new Date().toISOString();
		
		await db
			.insert(accessTokens)
			.values({
				sub: token.sub,
				accessToken: token.accessToken,
				accessTokenSecret: token.accessTokenSecret,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: accessTokens.sub,
				set: {
					accessToken: token.accessToken,
					accessTokenSecret: token.accessTokenSecret,
					updatedAt: now,
				},
			});
	},

	// AccessTokenを取得する
	async getAccessToken(
		db: ReturnType<typeof createDb>,
		sub: string,
	): Promise<AccessToken | null> {
		const result = await db
			.select({
				sub: accessTokens.sub,
				accessToken: accessTokens.accessToken,
				accessTokenSecret: accessTokens.accessTokenSecret,
			})
			.from(accessTokens)
			.where(eq(accessTokens.sub, sub))
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		return result[0];
	},

	// AccessTokenを削除する
	async deleteAccessToken(
		db: ReturnType<typeof createDb>,
		sub: string,
	): Promise<void> {
		await db
			.delete(accessTokens)
			.where(eq(accessTokens.sub, sub));
	},
};
