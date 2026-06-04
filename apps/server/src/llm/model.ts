/**
 * Cloudflare Workers AI を `workers-ai-provider` 経由で叩くための AI SDK モデルファクトリ。
 *
 * 本番（Workers ランタイム）からは `env.AI` をそのまま渡し、評価スクリプト（Node 上）
 * からは `getPlatformProxy()` で取得した binding を渡す。どちらも Ai インターフェースに
 * 準拠しているため経路を分岐する必要はない。
 */

import type { Ai } from "@cloudflare/workers-types";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

export interface CreateLanguageModelOptions {
  binding: Ai;
  model: string;
}

/**
 * Workers AI のモデルを返す。
 */
export const createLanguageModel = (options: CreateLanguageModelOptions): LanguageModel => {
  const workersai = createWorkersAI({ binding: options.binding });
  return workersai(options.model);
};
