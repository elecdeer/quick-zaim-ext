import * as v from "valibot";

/** Cloudflare Access で認証されたユーザー */
export type AccessUser = {
  /** アプリ内でユーザーを識別する ID（KV のキーなどに使う） */
  id: string;
  email: string;
};

type AccessContext = { getIdentity: () => Promise<unknown> };

/**
 * ExecutionContext が ctx.access を持つか判定する。
 *
 * ctx.access はランタイムが Access 認証済みのリクエストにだけ付与するプロパティで、
 * Hono の ExecutionContext 型にも現行の @cloudflare/workers-types にも定義がないため実行時に形を確かめる。
 * valibot の looseObject で検証すると出力が新しいオブジェクトになり、getIdentity をネイティブの
 * this から切り離して呼ぶことになって "Illegal invocation" で落ちるため、元のオブジェクトのまま判定する。
 */
const hasAccessContext = (ctx: unknown): ctx is { access: AccessContext } =>
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
 * ExecutionContext の `ctx.access` から Access 認証済みユーザーを取り出す。
 * Access を通っていないリクエスト、または identity にメールアドレスが含まれない場合は null を返す。
 *
 * ID にはメールアドレスを使う。ワンタイム PIN や外部 IdP のどれでログインしても同じ値になり、
 * IdP を切り替えても KV 上の Zaim 連携を引き継げるため。
 */
export const getAccessUser = async (executionCtx: unknown): Promise<AccessUser | null> => {
  if (!hasAccessContext(executionCtx)) return null;

  const identity = v.safeParse(AccessIdentitySchema, await executionCtx.access.getIdentity());
  if (!identity.success) return null;

  return { id: identity.output.email, email: identity.output.email };
};
