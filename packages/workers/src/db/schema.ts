import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// requestTokenテーブルの定義
export const requestTokens = sqliteTable("request_tokens", {
	// キーとなるトークン
	oauthToken: text("oauth_token").primaryKey(),
	// トークンシークレット
	oauthTokenSecret: text("oauth_token_secret").notNull(),
	// 作成日時
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// 型定義
export type RequestToken = {
	oauthToken: string;
	oauthTokenSecret: string;
};
