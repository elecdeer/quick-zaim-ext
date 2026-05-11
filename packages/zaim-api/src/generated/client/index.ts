/**
 * Zaim API クライアント型定義（スタブ）
 *
 * 本来は @hey-api/openapi-ts が生成するファイルだが、
 * コード生成を実行できない環境向けに手動で定義している。
 * 実際のランタイム実装は @hey-api/client-fetch が提供する。
 */

export type Config = {
  baseUrl?: string;
  headers?: Record<string, string>;
};

export type Client = {
  interceptors: {
    request: {
      use(fn: (req: Request) => Request | Promise<Request>): void;
      eject(fn: (req: Request) => Request | Promise<Request>): void;
    };
    response: {
      use(fn: (res: Response) => Response | Promise<Response>): void;
      eject(fn: (res: Response) => Response | Promise<Response>): void;
    };
  };
};

export type RequestResult<TData = unknown, TError = unknown> = Promise<{
  data: TData | undefined;
  error: TError | undefined;
  response: Response;
}>;

export function createClient(_config?: Config): Client {
  const noop = () => {};
  return {
    interceptors: {
      request: { use: noop, eject: noop },
      response: { use: noop, eject: noop },
    },
  };
}
