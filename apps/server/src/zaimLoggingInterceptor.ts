/**
 * Zaim API クライアントのリクエスト・レスポンスを常にログ出力するためのインターセプター集。
 *
 * `@hey-api/client-fetch` のインターセプター仕様に従い、
 *   - request: 直前のリクエスト（auth ヘッダー設定後）を debug で記録
 *   - response: レスポンス本文を `clone()` してから読み出し、status と本文を info / warn で記録
 *   - error: fetch 自体が失敗した場合（ネットワークエラー等）を error で記録
 * を提供する。
 */

import type { Logger } from "./loggerMiddleware.ts";

const RESPONSE_BODY_LOG_LIMIT = 2000;

const truncate = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit)}…[truncated ${text.length - limit} chars]`;

const formatUrl = (req: Request): { path: string; query: string } => {
  const url = new URL(req.url);
  return { path: url.pathname, query: url.search };
};

const readResponseBodyForLog = async (response: Response): Promise<string> => {
  try {
    return await response.clone().text();
  } catch (e) {
    return `[unreadable body: ${e instanceof Error ? e.message : String(e)}]`;
  }
};

export interface ZaimLoggingInterceptors {
  request: (request: Request) => Promise<Request>;
  response: (response: Response, request: Request) => Promise<Response>;
  error: (error: unknown, response: Response | undefined, request: Request | undefined) => unknown;
}

/**
 * Zaim API クライアント用のロギングインターセプターを生成する。
 *
 * 戻り値の `request` / `response` / `error` を、それぞれクライアントの
 * `interceptors.request.use(...)` などへ登録して使う。
 */
export const createZaimLoggingInterceptors = (logger: Logger): ZaimLoggingInterceptors => ({
  request: async (request) => {
    const { path, query } = formatUrl(request);
    logger
      .with({ method: request.method, path, query })
      .debug("Zaim API request: {method} {path}{query}");
    return request;
  },
  response: async (response, request) => {
    const { path, query } = formatUrl(request);
    const bodyText = await readResponseBodyForLog(response);
    const logLine = "Zaim API response: {method} {path}{query} {status}";
    const fields = {
      method: request.method,
      path,
      query,
      status: response.status,
      body: truncate(bodyText, RESPONSE_BODY_LOG_LIMIT),
    };
    if (response.ok) {
      logger.with(fields).info(logLine);
    } else {
      logger.with(fields).warn(logLine);
    }
    return response;
  },
  error: (error, response, request) => {
    const fields: Record<string, unknown> = {
      method: request?.method,
      ...(request ? formatUrl(request) : {}),
      status: response?.status,
      error: error instanceof Error ? error.message : error,
    };
    logger.with(fields).error("Zaim API error: {method} {path}{query} - {error}");
    return error;
  },
});
