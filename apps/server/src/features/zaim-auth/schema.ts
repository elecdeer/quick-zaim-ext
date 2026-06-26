import * as v from "valibot";

export const RequestTokenStateSchema = v.object({
  tokenSecret: v.string(),
  /** Request Token 取得時点でのログインユーザーの OIDC sub */
  userSub: v.string(),
  /** 拡張機能フロー時のみ: トークン交換後にリダイレクトする chromiumapp.org URL */
  extRedirectUri: v.optional(v.string()),
});

export const StoredAccessTokenSchema = v.object({
  oauthToken: v.string(),
  oauthTokenSecret: v.string(),
  zaimUserId: v.string(),
});

export const CallbackQuerySchema = v.object({
  oauth_token: v.string(),
  oauth_verifier: v.string(),
});

export const StartQuerySchema = v.object({
  ext_redirect_uri: v.optional(v.string()),
});

export type RequestTokenState = v.InferOutput<typeof RequestTokenStateSchema>;
export type StoredAccessToken = v.InferOutput<typeof StoredAccessTokenSchema>;
