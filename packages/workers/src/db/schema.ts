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

// accessTokenテーブルの定義
export const accessTokens = sqliteTable("access_tokens", {
	// OIDCのsub（主キー）- ユーザーの一意の識別子
	sub: text("sub").primaryKey(),
	// アクセストークン
	accessToken: text("access_token").notNull(),
	// アクセストークンシークレット
	accessTokenSecret: text("access_token_secret").notNull(),
	// 作成日時
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	// 更新日時
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// 型定義
export type AccessToken = {
	sub: string;
	accessToken: string;
	accessTokenSecret: string;
};
