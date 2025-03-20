import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { type RequestToken, requestTokens } from "./schema";

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
