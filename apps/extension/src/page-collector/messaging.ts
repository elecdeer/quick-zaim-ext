import type { AriaNode } from "./ariaSnapshot.ts";

/**
 * sidepanel から content script に送るページ収集リクエストの type 識別子。
 */
export const PAGE_COLLECTOR_MESSAGE_TYPE = "quick-zaim/page-collector/collect" as const;

export interface CollectPageContentRequest {
  type: typeof PAGE_COLLECTOR_MESSAGE_TYPE;
  options?: {
    maxNodes?: number;
  };
}

export type CollectPageContentResponse =
  | {
      ok: true;
      url: string;
      title: string;
      ariaSnapshot: string;
      ariaTree: AriaNode;
      collectedAt: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * 渡された値がページ収集リクエストかどうかを判定する。
 */
export const isCollectPageContentRequest = (msg: unknown): msg is CollectPageContentRequest => {
  if (typeof msg !== "object" || msg === null) return false;
  const candidate = msg as { type?: unknown; options?: unknown };
  if (candidate.type !== PAGE_COLLECTOR_MESSAGE_TYPE) return false;
  if (candidate.options !== undefined) {
    if (typeof candidate.options !== "object" || candidate.options === null) return false;
    const opt = candidate.options as { maxNodes?: unknown };
    if (opt.maxNodes !== undefined && typeof opt.maxNodes !== "number") return false;
  }
  return true;
};
