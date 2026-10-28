import type { RouteMap } from "void/routes";

/**
 * 型を再帰的に具体的なオブジェクト型へ展開する。
 *
 * void/routes の RouteMap は .void/routes.d.ts の module augmentation で中身が入るため、
 * 型宣言を出力するときに RouteMap のまま参照すると、拡張機能側では空の RouteMap になってしまう。
 * 推論された値の型として展開させると、宣言ファイルに具体的な型が書き出される。
 */
type Expand<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]: Expand<T[K]> }
    : T;

const expand = <T>(): Expand<T> => undefined as never;

const ledgerRoutes = expand<RouteMap>();

/** 台帳 API のルートごとの入出力型（拡張機能などアプリの外から使う） */
export type LedgerRoutes = typeof ledgerRoutes;
export type LedgerPath = keyof LedgerRoutes;
export type LedgerMethod<P extends LedgerPath> = keyof LedgerRoutes[P] & string;
type RouteEntry<P extends LedgerPath, M extends LedgerMethod<P>> = LedgerRoutes[P][M] extends {
  input: infer I;
  output: infer O;
}
  ? { input: I; output: O }
  : never;
export type LedgerInput<P extends LedgerPath, M extends LedgerMethod<P>> = RouteEntry<
  P,
  M
>["input"];
export type LedgerOutput<P extends LedgerPath, M extends LedgerMethod<P>> = RouteEntry<
  P,
  M
>["output"];

type RequestInput = {
  body?: unknown;
  query?: Record<string, string>;
  params?: Record<string, string>;
};

/** 台帳 API が 2xx 以外を返したときのエラー */
export class LedgerFetchError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown) {
    super(`Ledger API request failed with status ${status}`);
    this.name = "LedgerFetchError";
    this.status = status;
    this.data = data;
  }
}

/**
 * パスの `:name` をパラメータの値で置き換える。
 */
const interpolatePath = (path: string, params: Record<string, string> | undefined): string =>
  path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing route parameter: ${name}`);
    return encodeURIComponent(value);
  });

/**
 * レスポンスの本文を JSON として読み、本文がなければ undefined を返す。
 */
const readBody = async (res: Response): Promise<unknown> => {
  const text = await res.text();
  return text === "" ? undefined : JSON.parse(text);
};

/**
 * 台帳 API の型付きクライアントを作る。
 *
 * Void の typed fetch（void/client）は credentials や redirect を指定できず、
 * 拡張機能から Access のセッション Cookie を送れないため、型だけ借りて自前で呼ぶ。
 * 認証まわりの扱いは呼び出し側の fetch に任せる。
 */
export const createLedgerClient =
  (baseUrl: string, fetchFn: typeof fetch = fetch) =>
  async <P extends LedgerPath, M extends LedgerMethod<P>>(
    path: P,
    method: M,
    ...[input]: {} extends LedgerInput<P, M>
      ? [input?: LedgerInput<P, M>]
      : [input: LedgerInput<P, M>]
  ): Promise<LedgerOutput<P, M>> => {
    // LedgerInput は body / query / params のうちルートが受け取るものだけを持つ型なので、
    // 実行時に読むための共通の形として扱う
    const { body, query, params }: RequestInput = input ?? {};
    const url = new URL(interpolatePath(path, params), baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

    const res = await fetchFn(url, {
      method,
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    const data = await readBody(res);
    if (!res.ok) throw new LedgerFetchError(res.status, data);
    // レスポンスの形はサーバー側のハンドラの戻り値型から生成した LedgerOutput と一致する
    return data as LedgerOutput<P, M>;
  };
