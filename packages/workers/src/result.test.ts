import { assert, describe, expect, it } from "vitest";
import {
	err,
	flatMap,
	getOrElse,
	isErr,
	isOk,
	map,
	mapErr,
	match,
	ok,
	type Result,
	safeTry,
	safeTryAsync,
} from "./result";

describe("Result型ユーティリティ関数", () => {
	const divide = (a: number, b: number): Result<number, string> => {
		if (b === 0) {
			return err("ゼロ除算エラー");
		}
		return ok(a / b);
	};

	// --- ok と err ---
	describe("ok", () => {
		it("Okリザルトを正しく作成する", () => {
			const successResult = ok(10);
			expect(successResult._tag).toBe("Ok");
			expect(successResult.value).toBe(10);
		});
	});

	describe("err", () => {
		it("Errリザルトを正しく作成する", () => {
			const errorResult = err("エラーメッセージ");
			expect(errorResult._tag).toBe("Err");
			expect(errorResult.error).toBe("エラーメッセージ");
		});
	});

	// --- isOk と isErr ---
	describe("isOk", () => {
		it("Okリザルトに対してtrueを返す", () => {
			expect(isOk(ok(5))).toBe(true);
		});
		it("Errリザルトに対してfalseを返す", () => {
			expect(isOk(err("fail"))).toBe(false);
		});
	});

	describe("isErr", () => {
		it("Errリザルトに対してtrueを返す", () => {
			expect(isErr(err("fail"))).toBe(true);
		});
		it("Okリザルトに対してfalseを返す", () => {
			expect(isErr(ok(5))).toBe(false);
		});
	});

	// --- map ---
	describe("map", () => {
		const double = (n: number) => n * 2;
		const formatError = (e: string) => `Formatted Error: ${e}`;

		it("Okリザルトの値に関数を適用する", () => {
			const result = ok(5);
			const mapped = map(result, double);
			expect(isOk(mapped)).toBe(true);
			if (isOk(mapped)) {
				// 型ガードで安全にアクセス
				expect(mapped.value).toBe(10);
			}
		});

		it("Errリザルトは変更しない", () => {
			const result = err("エラー");
			const mapped = map(result, double);
			expect(isErr(mapped)).toBe(true);
			if (isErr(mapped)) {
				// 型ガード
				expect(mapped.error).toBe("エラー");
			}
		});

		it("Okリザルトの値に関数を適用し、Err関数は無視される", () => {
			const result = ok(5);
			const mapped = map(result, double, formatError);
			expect(isOk(mapped)).toBe(true);
			if (isOk(mapped)) {
				expect(mapped.value).toBe(10);
			}
		});

		it("Errリザルトのエラー値に関数を適用し、Ok関数は無視される", () => {
			const result = err("エラー");
			const mapped = map(result, double, formatError);
			expect(isErr(mapped)).toBe(true);
			if (isErr(mapped)) {
				expect(mapped.error).toBe("Formatted Error: エラー");
			}
		});
	});

	// --- mapErr ---
	describe("mapErr", () => {
		const formatError = (e: string) => `Error: ${e}`;
		it("Errリザルトのエラー値に関数を適用する", () => {
			const result = err("失敗");
			const mapped = mapErr(result, formatError);
			expect(isErr(mapped)).toBe(true);
			if (isErr(mapped)) {
				// 型ガード
				expect(mapped.error).toBe("Error: 失敗");
			}
		});
		it("Okリザルトは変更しない", () => {
			const result = ok(100);
			const mapped = mapErr(result, formatError);
			expect(isOk(mapped)).toBe(true);
			if (isOk(mapped)) {
				// 型ガード
				expect(mapped.value).toBe(100);
			}
		});
	});

	// --- flatMap ---
	describe("flatMap (andThen)", () => {
		it("Okリザルトの値にResultを返す関数を適用し、その結果を返す", () => {
			const result = ok(10);
			const nextResult = flatMap(result, (val) => divide(val, 2)); // ok(5)
			expect(isOk(nextResult)).toBe(true);
			if (isOk(nextResult)) {
				expect(nextResult.value).toBe(5);
			}
		});
		it("Okリザルトの値にResultを返す関数を適用し、Errが返る場合", () => {
			const result = ok(10);
			const nextResult = flatMap(result, (val) => divide(val, 0)); // err("ゼロ除算エラー")
			expect(isErr(nextResult)).toBe(true);
			if (isErr(nextResult)) {
				expect(nextResult.error).toBe("ゼロ除算エラー");
			}
		});
		it("Errリザルトは変更しない", () => {
			const result = err("初期エラー");
			const nextResult = flatMap(result, (val: number) => divide(val, 2));
			expect(isErr(nextResult)).toBe(true);
			if (isErr(nextResult)) {
				expect(nextResult.error).toBe("初期エラー");
			}
		});
	});

	// --- getOrElse ---
	describe("getOrElse", () => {
		it("Okリザルトの場合は中の値を返す", () => {
			const result = ok(42);
			expect(getOrElse(result, 0)).toBe(42);
		});
		it("Errリザルトの場合はデフォルト値を返す", () => {
			const result = err("エラー発生");
			expect(getOrElse(result, 0)).toBe(0);
		});
	});

	// --- match ---
	describe("match", () => {
		it("Okリザルトの場合はOk関数を呼び出す", () => {
			const result = ok(42);
			const output = match(
				result,
				(value) => `Ok: ${value}`,
				(error) => `Err: ${error}`,
			);
			expect(output).toBe("Ok: 42");
		});

		it("Errリザルトの場合はErr関数を呼び出す", () => {
			const result = err("エラー発生");
			const output = match(
				result,
				(value) => `Ok: ${value}`,
				(error) => `Err: ${error}`,
			);
			expect(output).toBe("Err: エラー発生");
		});
	});
	// --- safeTry ---
	describe("safeTry", () => {
		it("成功した場合はOkリザルトを返す", () => {
			const result = safeTry(
				() => 42,
				(error) => `Error: ${error}`,
			);
			expect(isOk(result)).toBe(true);
			if (isOk(result)) {
				expect(result.value).toBe(42);
			}
		});

		it("失敗した場合はErrリザルトを返す", () => {
			const result = safeTry(
				() => {
					throw new Error("失敗");
				},
				(error) => `Error: ${(error as Error).message}`,
			);
			expect(isErr(result)).toBe(true);
			if (isErr(result)) {
				expect(result.error).toBe("Error: 失敗");
			}
		});
	});

	// --- safeTryAsync ---
	describe("safeTryAsync", () => {
		it("成功した場合はOkリザルトを返す (非同期)", async () => {
			const result = await safeTryAsync(
				async () => Promise.resolve(42),
				(error) => `Error: ${error}`,
			);

			assert(isOk(result));
			expect(result.value).toBe(42);
		});

		it("失敗した場合はErrリザルトを返す (非同期)", async () => {
			const result = await safeTryAsync(
				// biome-ignore lint/suspicious/useAwait: テストなのでasyncで渡す
				async () => {
					throw new Error("失敗");
				},
				(error) => `Error: ${(error as Error).message}`,
			);

			assert(isErr(result));
			expect(result.error).toBe("Error: 失敗");
		});
	});
});
