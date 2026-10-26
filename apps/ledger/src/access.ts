import { verifyWithJwks } from "hono/jwt";
import * as v from "valibot";

/** Cloudflare Access で認証されたユーザー */
export type AccessUser = {
  /** アプリ内でユーザーを識別する ID（KV のキーなどに使う） */
  id: string;
  email: string;
};

/** Access が付与する JWT（Cf-Access-Jwt-Assertion）を検証するための設定 */
export type AccessJwtConfig = {
  /** Access のチームドメイン（例: https://<team>.cloudflareaccess.com）。JWT の iss と公開鍵の取得元になる */
  teamDomain: string;
  /** Access アプリケーションの AUD タグ */
  aud: string;
};

/** JWT からユーザーを取り出した結果。取り出せなかったときは原因調査用の理由を返す */
export type AccessJwtResult = { user: AccessUser } | { user: null; reason: string };

type AccessContext = { getIdentity: () => Promise<unknown> };

/**
 * ExecutionContext が ctx.access を持つか判定する。
 *
 * ctx.access はランタイムが Access 認証済みのリクエストにだけ付与するプロパティで、
 * Hono の ExecutionContext 型にも現行の @cloudflare/workers-types にも定義がないため実行時に形を確かめる。
 * valibot の looseObject で検証すると出力が新しいオブジェクトになり、getIdentity をネイティブの
 * this から切り離して呼ぶことになって "Illegal invocation" で落ちるため、元のオブジェクトのまま判定する。
 */
export const hasAccessContext = (ctx: unknown): ctx is { access: AccessContext } =>
  typeof ctx === "object" &&
  ctx !== null &&
  "access" in ctx &&
  typeof ctx.access === "object" &&
  ctx.access !== null &&
  "getIdentity" in ctx.access &&
  typeof ctx.access.getIdentity === "function";

const AccessIdentitySchema = v.looseObject({
  email: v.pipe(v.string(), v.email()),
});

/**
 * メールアドレスから AccessUser を作る。
 *
 * ID にはメールアドレスを使う。ワンタイム PIN や外部 IdP のどれでログインしても同じ値になり、
 * IdP を切り替えても KV 上の Zaim 連携を引き継げるため。
 */
const toAccessUser = (email: string): AccessUser => ({ id: email, email });

/**
 * ExecutionContext の `ctx.access` から Access 認証済みユーザーを取り出す。
 * Access を通っていないリクエスト、または identity にメールアドレスが含まれない場合は null を返す。
 */
export const getAccessUser = async (executionCtx: unknown): Promise<AccessUser | null> => {
  if (!hasAccessContext(executionCtx)) return null;

  const identity = v.safeParse(AccessIdentitySchema, await executionCtx.access.getIdentity());
  if (!identity.success) return null;

  return toAccessUser(identity.output.email);
};

/**
 * Access が付与する `Cf-Access-Jwt-Assertion` を検証してユーザーを取り出す。
 *
 * Preview URL へのリクエストでは Access を通過していても ctx.access が渡らないことがあるため、
 * Cloudflare が案内している JWT 検証（チームの公開鍵で署名、iss と aud を確認）で代替する。
 * ヘッダー自体はクライアントでも付けられるので、検証せずに中身やメールのヘッダーを信用してはいけない。
 */
export const getAccessUserFromJwt = async (
  token: string | undefined,
  config: AccessJwtConfig | undefined,
): Promise<AccessJwtResult> => {
  if (!token) return { user: null, reason: "Cf-Access-Jwt-Assertion header is missing" };
  if (!config) return { user: null, reason: "ACCESS_TEAM_DOMAIN or ACCESS_AUD is not configured" };

  const teamDomain = config.teamDomain.replace(/\/$/, "");
  let payload: unknown;
  try {
    payload = await verifyWithJwks(token, {
      jwks_uri: `${teamDomain}/cdn-cgi/access/certs`,
      allowedAlgorithms: ["RS256"],
      verification: { iss: teamDomain, aud: config.aud },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { user: null, reason: `Access JWT verification failed: ${message}` };
  }

  const claims = v.safeParse(AccessIdentitySchema, payload);
  if (!claims.success) return { user: null, reason: "Access JWT has no email claim" };

  return { user: toAccessUser(claims.output.email) };
};
