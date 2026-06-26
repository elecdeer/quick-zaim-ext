/**
 * LLM 支払い情報抽出の評価スクリプト。
 *
 * `apps/server/scripts/eval-fixtures/*.json` に置かれたケースを複数モデルで実行し、
 * フィールドごとの一致率・所要時間・トークン使用量を集計して表示する。
 *
 * Wrangler の `getPlatformProxy()` を使い、`wrangler.jsonc` で宣言した
 * `AI` binding をそのまま Node から叩く。認証は `wrangler login` 済みの
 * 資格情報または環境変数 `CLOUDFLARE_API_TOKEN`（+ 必要なら `CLOUDFLARE_ACCOUNT_ID`）を使う。
 *
 * 注意: Workers AI binding はローカルエミュレーションを持たない（`remote: true` 必須）。
 * 評価スクリプトでも実際の Cloudflare アカウントの Workers AI 利用枠を消費するため、
 * 本番と挙動が異なるリスクは事実上ない反面、課金は発生する。
 *
 * 実行:
 *   pnpm --filter server run eval:extract-payment
 *   pnpm --filter server run eval:extract-payment -- --models @cf/meta/llama-3.3-70b-instruct-fp8-fast,@cf/moonshotai/kimi-k2.5
 */

import type { Ai } from "@cloudflare/workers-types";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as v from "valibot";
import { getPlatformProxy } from "wrangler";
import {
  ExtractPaymentBodySchema,
  ExtractedPaymentSchema,
  type ExtractPaymentBody,
  type ExtractedPayment,
} from "../src/features/llm/schema.ts";
import { runExtractPayment } from "../src/features/llm/service.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "eval-fixtures");
const RESULTS_DIR = join(SCRIPT_DIR, "eval-results");

const FixtureSchema = v.object({
  name: v.string(),
  input: ExtractPaymentBodySchema,
  expected: v.partial(ExtractedPaymentSchema),
});

type Fixture = v.InferOutput<typeof FixtureSchema>;

interface ModelTarget {
  model: string;
}

const DEFAULT_TARGETS: ModelTarget[] = [
  { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { model: "@cf/moonshotai/kimi-k2.5" },
];

const parseModelsArg = (raw: string | undefined): ModelTarget[] => {
  if (!raw) return DEFAULT_TARGETS;
  return raw.split(",").map((model) => {
    const trimmed = model.trim();
    if (!trimmed) throw new Error("Empty model id in --models");
    return { model: trimmed };
  });
};

const parseCliArgs = (argv: string[]): { models: ModelTarget[] } => {
  // `pnpm run ... -- --models foo` のとき argv 先頭に `--` が混ざる。
  // node:util の parseArgs は `--` を end-of-options として扱うので、事前に剥がす。
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const { values } = parseArgs({
    args,
    options: {
      models: { type: "string" },
    },
    strict: true,
  });
  return { models: parseModelsArg(values.models) };
};

const loadFixtures = async (): Promise<Fixture[]> => {
  let entries: string[];
  try {
    entries = await readdir(FIXTURES_DIR);
  } catch {
    return [];
  }
  const fixtures: Fixture[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const raw = await readFile(join(FIXTURES_DIR, entry), "utf8");
    const parsed = v.parse(FixtureSchema, JSON.parse(raw));
    fixtures.push(parsed);
  }
  return fixtures;
};

const EVAL_FIELDS = ["date", "accountId", "place", "items"] as const satisfies ReadonlyArray<
  keyof ExtractedPayment
>;

interface CaseResult {
  fixture: string;
  ok: boolean;
  matched: number;
  total: number;
  durationMs: number;
  usage: unknown;
  diffs: Array<{ field: string; expected: unknown; actual: unknown }>;
  error?: string;
  actual?: ExtractedPayment;
}

interface ModelResult {
  target: ModelTarget;
  cases: CaseResult[];
  totalMatched: number;
  totalEvaluated: number;
  totalDurationMs: number;
}

const compareField = (expected: unknown, actual: unknown): boolean => {
  if (expected === undefined) return true; // expected で未指定なら評価対象外
  if (expected === actual) return true;
  // items のような配列・オブジェクトは JSON 文字列で深い等価判定する
  if (typeof expected === "object" && expected !== null) {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }
  return false;
};

const runCase = async (target: ModelTarget, fixture: Fixture, ai: Ai): Promise<CaseResult> => {
  const started = performance.now();
  try {
    const { object, usage } = await runExtractPayment({
      ai,
      model: target.model,
      input: fixture.input as ExtractPaymentBody,
    });
    const durationMs = performance.now() - started;

    const diffs: CaseResult["diffs"] = [];
    let matched = 0;
    let total = 0;
    for (const field of EVAL_FIELDS) {
      const expected = (fixture.expected as Partial<ExtractedPayment>)[field];
      if (expected === undefined) continue;
      total++;
      const actual = object[field];
      if (compareField(expected, actual)) {
        matched++;
      } else {
        diffs.push({ field, expected, actual });
      }
    }

    return {
      fixture: fixture.name,
      ok: true,
      matched,
      total,
      durationMs,
      usage,
      diffs,
      actual: object,
    };
  } catch (error) {
    return {
      fixture: fixture.name,
      ok: false,
      matched: 0,
      total: 0,
      durationMs: performance.now() - started,
      usage: undefined,
      diffs: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const formatModelLabel = (target: ModelTarget): string => target.model;

const printTable = (results: ModelResult[]): void => {
  const headers = ["Model", "Cases", "Accuracy", "Avg time", "OK"];
  const rows = results.map((result) => {
    const accuracy =
      result.totalEvaluated > 0
        ? `${((result.totalMatched / result.totalEvaluated) * 100).toFixed(1)}%`
        : "n/a";
    const okCount = result.cases.filter((c) => c.ok).length;
    const avg =
      result.cases.length > 0
        ? `${(result.totalDurationMs / result.cases.length).toFixed(0)}ms`
        : "n/a";
    return [
      formatModelLabel(result.target),
      String(result.cases.length),
      accuracy,
      avg,
      `${okCount}/${result.cases.length}`,
    ];
  });
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );
  const renderRow = (cols: string[]): string =>
    cols.map((col, i) => col.padEnd(widths[i] ?? 0)).join("  ");
  console.log(renderRow(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(renderRow(row));
};

const printDiffs = (results: ModelResult[]): void => {
  for (const result of results) {
    console.log(`\n## ${formatModelLabel(result.target)}`);
    for (const c of result.cases) {
      if (!c.ok) {
        console.log(`  - [${c.fixture}] ERROR: ${c.error}`);
        continue;
      }
      const score = `${c.matched}/${c.total}`;
      console.log(`  - [${c.fixture}] ${score} (${c.durationMs.toFixed(0)}ms)`);
      for (const diff of c.diffs) {
        console.log(
          `      ${diff.field}: expected=${JSON.stringify(diff.expected)} actual=${JSON.stringify(diff.actual)}`,
        );
      }
    }
  }
};

const saveResults = async (results: ModelResult[]): Promise<string> => {
  await mkdir(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(RESULTS_DIR, `${stamp}.json`);
  await writeFile(outPath, JSON.stringify(results, null, 2), "utf8");
  return outPath;
};

const main = async (): Promise<void> => {
  const { models } = parseCliArgs(process.argv.slice(2));
  const fixtures = await loadFixtures();

  if (fixtures.length === 0) {
    console.log(`No fixtures found in ${FIXTURES_DIR}.`);
    console.log("Add JSON files matching the FixtureSchema before running evaluation.");
    return;
  }

  console.log(`Evaluating ${fixtures.length} fixture(s) against ${models.length} model(s)...\n`);

  // wrangler.jsonc に宣言した AI binding を Node から取り出す。
  // 認証は wrangler login 済みの資格情報 or CLOUDFLARE_API_TOKEN を使う。
  const platform = await getPlatformProxy<{ AI: Ai }>();

  try {
    const results: ModelResult[] = [];
    for (const target of models) {
      const cases: CaseResult[] = [];
      for (const fixture of fixtures) {
        const result = await runCase(target, fixture, platform.env.AI);
        cases.push(result);
      }
      results.push({
        target,
        cases,
        totalMatched: cases.reduce((sum, c) => sum + c.matched, 0),
        totalEvaluated: cases.reduce((sum, c) => sum + c.total, 0),
        totalDurationMs: cases.reduce((sum, c) => sum + c.durationMs, 0),
      });
    }

    printTable(results);
    printDiffs(results);

    const outPath = await saveResults(results);
    console.log(`\nFull results written to ${resolve(outPath)}`);
  } finally {
    await platform.dispose();
  }
};

await main();
