// Okバリアントのインターフェース
type Ok<T> = {
	readonly _tag: "Ok";
	readonly value: T;
	readonly error?: never;
};

// Errバリアントの型
type Err<E> = {
	readonly _tag: "Err";
	readonly value?: never;
	readonly error: E;
};

// Result型はOkとErrの合併型(union type)
export type Result<T, E> = Ok<T> | Err<E>;

// --- コンストラクタ関数 ---

/**
 * 成功値を含むOkリザルトを作成します。
 * @param value 成功値。
 * @returns Okリザルト。
 */
export const ok = <T>(value: T): Ok<T> => ({
	_tag: "Ok",
	value,
});

/**
 * エラー値を含むErrリザルトを作成します。
 * @param error エラー値。
 * @returns Errリザルト。
 */
export const err = <E>(error: E): Err<E> => ({
	_tag: "Err",
	error,
});

// --- 型ガード ---

/**
 * リザルトがOkバリアントかどうかをチェックします。
 * @param result チェックするリザルト。
 * @returns リザルトがOkの場合はtrue、それ以外はfalse。
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
	result._tag === "Ok";

/**
 * リザルトがErrバリアントかどうかをチェックします。
 * @param result チェックするリザルト。
 * @returns リザルトがErrの場合はtrue、それ以外はfalse。
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
	result._tag === "Err";

// --- ユーティリティ関数 ---

/**
 * Result<T, E> を Result<U, F> にマップします。
 * 含まれるOk値に関数を適用し、Err値にも関数を適用します。
 * mapErrは省略可能で、省略された場合は元のErr値をそのまま使用します。
 * @param result 入力リザルト。
 * @param mapOk Ok値に適用する関数。
 * @param mapErr Err値に適用する関数（省略可能）。
 * @returns マップされたOk値またはErr値を持つ新しいResult。
 */
export type Map = {
	<T, U, E, F>(
		result: Result<T, E>,
		mapOk: (value: T) => U,
		mapErr: (error: E) => F,
	): Result<U, F>;
	<T, U, E>(result: Result<T, E>, mapOk: (value: T) => U): Result<U, E>;
};

export const map: Map = <T, U, E, F = E>(
	result: Result<T, E>,
	mapOk: (value: T) => U,
	mapErr?: ((error: E) => F) | undefined,
): Result<U, F> | Result<U, E> => {
	if (isOk(result)) {
		return ok(mapOk(result.value));
	}
	if (mapErr) {
		return err(mapErr(result.error));
	}
	return result; // Errは変更されない
};

/**
 * Result<T, E> を Result<T, F> にマップします。
 * 含まれるErr値に関数を適用し、Ok値はそのまま残します。
 * @param result 入力リザルト。
 * @param fn Err値に適用する関数。
 * @returns マップされたErr値を持つ新しいResult、または元のOk。
 */
export const mapErr = <T, E, F>(
	result: Result<T, E>,
	fn: (error: E) => F,
): Result<T, F> => {
	if (isErr(result)) {
		return err(fn(result.error));
	}
	return result; // Okは変更されない
};

/**
 * Resultを返す関数をOk値に適用します。
 * 入力リザルトがOkの場合、その値で関数を呼び出し、その結果を返します。
 * 入力リザルトがErrの場合、元のErrを返します。
 * `andThen` や `bind` とも呼ばれます。
 * @param result 入力リザルト。
 * @param fn Ok値に適用する関数（Resultを返す）。
 * @returns 関数の結果、または元のErr。
 */
export const flatMap = <T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>,
): Result<U, E> => {
	if (isOk(result)) {
		return fn(result.value);
	}
	return result; // Errは変更されない
};

/**
 * 含まれるOk値を返すか、リザルトがErrの場合は提供されたデフォルト値を返します。
 * @param result 入力リザルト。
 * @param defaultValue リザルトがErrの場合に返す値。
 * @returns Ok値またはデフォルト値。
 */
export const getOrElse = <T, E>(result: Result<T, E>, defaultValue: T): T => {
	if (isOk(result)) {
		return result.value;
	}
	return defaultValue;
};

/**
 * OkとErrの両方のケースを処理する関数を提供して、リザルトをアンラップします。
 * これにより、Resultの網羅的なチェックとハンドリングが可能になります。
 * @param result 入力リザルト。
 * @param okFn Ok値に適用する関数。
 * @param errFn Err値に適用する関数。
 * @returns 実行されたパターン関数によって返される値。
 */
export const match = <T, E, U, F>(
	result: Result<T, E>,
	okFn: (value: T) => U,
	errFn: (error: E) => F,
): U | F => {
	if (isOk(result)) {
		return okFn(result.value);
	}
	return errFn(result.error);
};

/**
 * 指定された関数を実行し、成功した場合はOkリザルトを返し、
 * 失敗した場合はErrリザルトを返します。
 *
 * @param fn 実行する関数。
 * @param errorHandler エラーを処理する関数。
 * @returns 成功時はOkリザルト、失敗時はErrリザルト。
 */
export const safeTry = <const T, const E>(
	fn: () => T,
	errorHandler: (error: unknown) => E,
): Result<T, E> => {
	try {
		const result = fn();
		return ok(result);
	} catch (error) {
		return err(errorHandler(error));
	}
};

/**
 * 指定された非同期関数を実行し、成功した場合はOkリザルトを返し、
 * 失敗した場合はErrリザルトを返します。
 *
 * @param fn 実行する非同期関数。
 * @param errorHandler エラーを処理する関数。
 * @returns 成功時はOkリザルト、失敗時はErrリザルト。
 */
export const safeTryAsync = async <const T, const E>(
	fn: () => Promise<T>,
	errorHandler: (error: unknown) => E,
): Promise<Result<T, E>> => {
	try {
		const result = await fn();
		return ok(result);
	} catch (error) {
		return err(errorHandler(error));
	}
};
