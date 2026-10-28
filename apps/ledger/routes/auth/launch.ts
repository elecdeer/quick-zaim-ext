import * as v from "valibot";
import { defineHandler } from "void";

/**
 * 拡張機能の chrome.identity.getRedirectURL() が返す URL（https://<id>.chromiumapp.org/）か判定する。
 */
const isValidExtensionRedirectUri = (uri: string): boolean => {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
};

const LaunchQuerySchema = v.object({
  redirect_uri: v.pipe(v.string(), v.check(isValidExtensionRedirectUri, "Invalid redirect_uri")),
});

/**
 * 拡張機能のログイン起動。
 *
 * ここに来た時点で Access のログインは済んでいて、このホストの CF_Authorization Cookie が付いているので、
 * 拡張機能の launchWebAuthFlow を終わらせるために拡張機能へ戻すだけでよい。
 */
export const GET = defineHandler.withValidator({ query: LaunchQuerySchema })((c, { query }) =>
  c.redirect(query.redirect_uri),
);
