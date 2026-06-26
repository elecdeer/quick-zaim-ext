import type { KVNamespace } from "@cloudflare/workers-types";
import * as v from "valibot";
import {
  RequestTokenStateSchema,
  StoredAccessTokenSchema,
  type RequestTokenState,
  type StoredAccessToken,
} from "./schema.ts";

/**
 * 指定ユーザーの Zaim アクセストークンを KV から取得する。
 */
export const getStoredZaimToken = async (
  kv: KVNamespace,
  userSub: string,
): Promise<StoredAccessToken | null> => {
  const stored = await kv.get(`zaim:token:${userSub}`);
  if (!stored) return null;
  return v.parse(StoredAccessTokenSchema, JSON.parse(stored));
};

/**
 * Zaim アクセストークンを KV に保存する。
 */
export const saveAccessToken = async (
  kv: KVNamespace,
  userSub: string,
  tokenData: StoredAccessToken,
): Promise<void> => {
  await kv.put(`zaim:token:${userSub}`, JSON.stringify(tokenData));
};

/**
 * Zaim アクセストークンを KV から削除する。
 */
export const deleteAccessToken = async (kv: KVNamespace, userSub: string): Promise<void> => {
  await kv.delete(`zaim:token:${userSub}`);
};

/**
 * Request Token の状態を KV から取得する。
 */
export const getRequestTokenState = async (
  kv: KVNamespace,
  oauthToken: string,
): Promise<RequestTokenState | null> => {
  const stored = await kv.get(`zaim:request:${oauthToken}`);
  if (!stored) return null;
  return v.parse(RequestTokenStateSchema, JSON.parse(stored));
};

/**
 * Request Token の状態を KV に保存する。
 */
export const saveRequestTokenState = async (
  kv: KVNamespace,
  oauthToken: string,
  state: RequestTokenState,
  ttl: number,
): Promise<void> => {
  await kv.put(`zaim:request:${oauthToken}`, JSON.stringify(state), { expirationTtl: ttl });
};

/**
 * Request Token の状態を KV から削除する。
 */
export const deleteRequestToken = async (kv: KVNamespace, oauthToken: string): Promise<void> => {
  await kv.delete(`zaim:request:${oauthToken}`);
};
