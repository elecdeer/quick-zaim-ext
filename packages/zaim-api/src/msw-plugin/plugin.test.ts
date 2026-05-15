import { createClient } from "@hey-api/openapi-ts";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";

import { defineConfig } from "./config";
import { toCamelCase, toMswPath } from "./utils";

// ──────────────────────────────────────────────
// toCamelCase
// ──────────────────────────────────────────────

describe("toCamelCase", () => {
  test("先頭文字を小文字にする", () => {
    expect(toCamelCase("Hello")).toBe("hello");
  });

  test("すでに小文字始まりの場合は変化なし", () => {
    expect(toCamelCase("hello")).toBe("hello");
  });

  test("残りの文字はそのまま保持する", () => {
    expect(toCamelCase("AccountGetAccounts")).toBe("accountGetAccounts");
  });

  test("1文字の文字列に対応する", () => {
    expect(toCamelCase("A")).toBe("a");
  });
});

// ──────────────────────────────────────────────
// toMswPath
// ──────────────────────────────────────────────

describe("toMswPath", () => {
  test("パスパラメータを :param 形式に変換する", () => {
    expect(toMswPath("/users/{id}")).toBe("/users/:id");
  });

  test("複数のパスパラメータを変換する", () => {
    expect(toMswPath("/users/{userId}/posts/{postId}")).toBe("/users/:userId/posts/:postId");
  });

  test("パスパラメータがない場合はそのまま返す", () => {
    expect(toMswPath("/accounts")).toBe("/accounts");
  });

  test("ハイフンを含むパラメータ名の特殊文字を除去する", () => {
    expect(toMswPath("/items/{item-id}")).toBe("/items/:itemid");
  });

  test("ドットを含むパラメータ名の特殊文字を除去する", () => {
    expect(toMswPath("/v2/{api.version}/data")).toBe("/v2/:apiversion/data");
  });
});

// ──────────────────────────────────────────────
// 統合テスト: createClient でコード生成
// ──────────────────────────────────────────────

const minimalSpec = {
  openapi: "3.1.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/accounts": {
      get: {
        operationId: "accountGetAccounts",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accounts: {
                      type: "array",
                      items: { type: "object" },
                    },
                    total: { type: "number" },
                  },
                  required: ["accounts", "total"],
                },
              },
            },
          },
        },
      },
    },
    "/accounts/{id}": {
      delete: {
        operationId: "accountDeleteAccount",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          204: { description: "Deleted" },
        },
      },
    },
  },
};

describe("MSW プラグイン 統合テスト", () => {
  let outputDir: string;
  let generated: string;

  beforeAll(async () => {
    outputDir = await mkdtemp(path.join(os.tmpdir(), "hey-api-msw-test-"));
    await mkdir(outputDir, { recursive: true });

    await createClient({
      input: { path: minimalSpec as any },
      output: outputDir,
      plugins: ["@hey-api/typescript", defineConfig({ bundleFunctionName: "getTestMock" })],
    });

    const files = await readdir(outputDir);
    const mswFile = files.find((f) => f.includes("my-msw-plugin"));
    if (!mswFile) throw new Error(`生成ファイルが見つかりません: ${files.join(", ")}`);
    generated = await readFile(path.join(outputDir, mswFile), "utf-8");
  });

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  test("msw から http と HttpResponse をインポートする", () => {
    expect(generated).toMatch(/import\s*{[^}]*\bhttp\b[^}]*}\s*from\s*["']msw["']/);
    expect(generated).toMatch(/\bHttpResponse\b/);
  });

  test("RequestHandlerOptions を型インポートする", () => {
    expect(generated).toMatch(/\btype\s+RequestHandlerOptions\b/);
  });

  test("GET /accounts のハンドラー関数を生成する", () => {
    expect(generated).toContain("accountGetAccountsMockHandler");
  });

  test("DELETE /accounts/{id} のハンドラー関数を生成する", () => {
    expect(generated).toContain("accountDeleteAccountMockHandler");
  });

  test("MSW パス形式（*/path）でルートを登録する", () => {
    expect(generated).toContain("*/accounts");
  });

  test("パスパラメータを :param 形式に変換する", () => {
    expect(generated).toContain("*/accounts/:id");
  });

  test("http.get を使う", () => {
    expect(generated).toMatch(/http\.get\s*\(/);
  });

  test("http.delete を使う", () => {
    expect(generated).toMatch(/http\.delete\s*\(/);
  });

  test("指定した bundleFunctionName でバンドル関数を生成する", () => {
    expect(generated).toContain("getTestMock");
  });

  test("バンドル関数が全ハンドラーを返す配列を含む", () => {
    expect(generated).toMatch(/getTestMock\s*=\s*\(\s*\)\s*=>/);
    expect(generated).toContain("accountGetAccountsMockHandler()");
    expect(generated).toContain("accountDeleteAccountMockHandler()");
  });

  test("501 のフォールバックレスポンスを含む", () => {
    expect(generated).toContain("501");
    expect(generated).toContain("Not Implemented");
  });

  test("instanceof Response チェックを含む", () => {
    expect(generated).toContain("instanceof Response");
  });

  test("typeof overrideResponse === 'function' チェックを含む", () => {
    expect(generated).toMatch(/typeof\s+overrideResponse\s*===\s*["']function["']/);
  });
});
