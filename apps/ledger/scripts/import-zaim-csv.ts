/**
 * Zaim の CSV（ファイル入出力）を台帳に取り込む SQL に変換する。DB には触れない。
 *
 *   vpx scripts/import-zaim-csv.ts <Zaim の CSV> --out <SQL の出力先> [--summary <集計の出力先>]
 *     [--batch-dir <バッチの出力先> [--batch-size <1 バッチの文の数>]]
 *
 * --out の SQL はローカルの D1 に `void db execute --file` で流す。本番の D1 には、Void がファイルの中身を
 * コマンドの引数で渡すため大きいと流せない（E2BIG）ので、--batch-dir に分けて出した JSON を
 * `cf d1 raw --batch @<file>` で順に流す。
 * --summary には方法・月ごとの件数と合計を JSON で出し、取り込み後の台帳で SUMMARY_SQL を流した結果と突き合わせる。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "csv-parse/sync";
import {
  buildImportStatements,
  chunkStatements,
  groupIntoTransactions,
  parseZaimRecords,
  summarizeRows,
  ZAIM_CSV_HEADER,
  type ZaimCsvRecord,
} from "../src/import/zaimCsv.ts";

const DEFAULT_BATCH_SIZE = 500;

/**
 * CSV を文字列にする。Zaim は出力時に UTF-8 と Shift_JIS を選べるので、UTF-8 として読めなければ Shift_JIS で読む。
 */
const decodeCsv = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
};

/**
 * 見出しが Zaim の形式と完全に一致するか確かめる。列の増減や名前の変更に気づかず取り込まないため。
 */
const assertHeader = (header: string[]): void => {
  if (header.join(",") !== ZAIM_CSV_HEADER.join(",")) {
    throw new Error(`見出しが Zaim の CSV と一致しません: ${header.join(",")}`);
  }
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    summary: { type: "string" },
    "batch-dir": { type: "string" },
    "batch-size": { type: "string" },
  },
});
const [csvPath] = positionals;
const batchSize = Number(values["batch-size"] ?? DEFAULT_BATCH_SIZE);
if (
  csvPath === undefined ||
  values.out === undefined ||
  !Number.isInteger(batchSize) ||
  batchSize < 1
) {
  console.error(
    "使い方: vpx scripts/import-zaim-csv.ts <CSV> --out <SQL> [--summary <JSON>] [--batch-dir <dir> [--batch-size <n>]]",
  );
  process.exit(1);
}

const rows: string[][] = parse(decodeCsv(readFileSync(csvPath)), { skip_empty_lines: true });
const [header, ...body] = rows;
if (header === undefined) throw new Error("CSV が空です");
assertHeader(header);

const records = body.map(
  // 見出しの検証を通っているので、列の並びは ZAIM_CSV_HEADER と同じ
  (cells) =>
    Object.fromEntries(
      ZAIM_CSV_HEADER.map((column, i) => [column, cells[i] ?? ""]),
    ) as ZaimCsvRecord,
);
const parsed = parseZaimRecords(records);
if (!parsed.ok) {
  for (const error of parsed.errors.slice(0, 50))
    console.error(`${error.line} 行目: ${error.message}`);
  console.error(`${parsed.errors.length} 行に問題があるため、SQL を出力しませんでした`);
  process.exit(1);
}

const transactions = groupIntoTransactions(parsed.rows);
const statements = buildImportStatements(transactions, {
  fileName: basename(csvPath),
  rowCount: records.length,
});
writeFileSync(values.out, `${statements.join(";\n")};\n`);
if (values.summary !== undefined) {
  writeFileSync(values.summary, `${JSON.stringify(summarizeRows(parsed.rows), null, 2)}\n`);
}

const batchDir = values["batch-dir"];
const batches = batchDir === undefined ? [] : chunkStatements(statements, batchSize);
if (batchDir !== undefined) {
  mkdirSync(batchDir, { recursive: true });
  batches.forEach((batch, i) => {
    // 流す順に並ぶよう、ファイル名の番号は桁をそろえる
    const name = `batch-${String(i + 1).padStart(4, "0")}.json`;
    writeFileSync(join(batchDir, name), JSON.stringify(batch.map((sql) => ({ sql }))));
  });
}

const receipts = transactions.filter((transaction) => transaction.items.length > 1);
console.info(
  [
    `${records.length} 行 → 取引 ${transactions.length} 件`,
    `（うち複数の品目をまとめたレシート ${receipts.length} 件、品目 ${receipts.reduce((sum, t) => sum + t.items.length, 0)} 件）`,
    `SQL: ${values.out}（${statements.length} 文）`,
    ...(batchDir === undefined ? [] : [`バッチ: ${batchDir}（${batches.length} 個）`]),
  ].join("\n"),
);
