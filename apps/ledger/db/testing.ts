import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

/** マイグレーションのファイル名を適用順（名前の昇順）に返す */
export const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

/**
 * マイグレーションを順に適用する。省略時はすべて適用する。
 */
export const applyMigrations = (db: DatabaseSync, files: string[] = migrationFiles()): void => {
  for (const name of files) {
    db.exec(readFileSync(new URL(name, MIGRATIONS_DIR), "utf8"));
  }
};

/**
 * メモリ上に DB を作る。D1 は外部キーを常に検証するので、同じ条件になるよう foreign_keys を有効にする。
 */
export const createDb = (): DatabaseSync => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
};

/** INSERT を実行し、作られた行の id を返す */
export const insert = (
  db: DatabaseSync,
  sql: string,
  ...params: (string | number | null)[]
): number => Number(db.prepare(sql).run(...params).lastInsertRowid);
