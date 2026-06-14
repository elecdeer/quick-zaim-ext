/**
 * Zaim API クライアント呼び出し（@hey-api/client-fetch）が失敗した際に、
 * ログに残すための情報を抽出するユーティリティ。
 *
 * `paymentOperationsCreate` などの SDK 関数は失敗時に
 *   { data: undefined, error, request, response }
 * を返す。本ヘルパーはここから status / body / message を取り出し、
 * 構造化ログにそのまま埋め込める形に整形する。
 */

export interface ZaimApiErrorContext {
  /** Zaim API から返ってきた HTTP ステータスコード（fetch 自体が失敗した場合は undefined） */
  upstreamStatus: number | undefined;
  /** Zaim API のレスポンス本文（パース済 JSON または text） */
  upstreamBody: unknown;
  /** デバッグ用の短い説明文 */
  upstreamMessage: string;
}

export interface FailedZaimApiResult {
  data?: unknown;
  error?: unknown;
  response?: { status?: number; statusText?: string } | undefined;
}

/**
 * Zaim API 失敗結果からログに載せる情報を抽出する。
 */
export const toZaimApiErrorContext = (result: FailedZaimApiResult): ZaimApiErrorContext => {
  const status = result.response?.status;
  const statusText = result.response?.statusText;

  const body = normalizeErrorBody(result.error);

  const messageParts: string[] = [];
  if (status !== undefined) {
    messageParts.push(statusText ? `HTTP ${status} ${statusText}` : `HTTP ${status}`);
  } else {
    messageParts.push("no response from Zaim API");
  }

  if (typeof body === "string" && body.length > 0) {
    messageParts.push(body);
  } else if (body && typeof body === "object") {
    try {
      messageParts.push(JSON.stringify(body));
    } catch {
      messageParts.push("[unserializable body]");
    }
  }

  return {
    upstreamStatus: status,
    upstreamBody: body,
    upstreamMessage: messageParts.join(" - "),
  };
};

const normalizeErrorBody = (error: unknown): unknown => {
  if (error == null) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === "string" || typeof error === "number" || typeof error === "boolean") {
    return error;
  }
  return error;
};
