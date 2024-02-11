import { useCallback, useRef } from "react";

/**
 * Promiseとその解決関数を返すhook
 * @returns
 *  - wait: Promiseを返す関数
 *  - done: Promiseをresolveする関数
 *  - abort: Promiseをrejectする関数
 */
export const usePromiseResolvers = <T>() => {
	const cbRef = useRef<{
		done: (value: T) => void;
		abort: () => void;
	}>();

	const done = useCallback<(value: T) => void>((value: T) => {
		cbRef.current?.done?.(value);
		cbRef.current = undefined;
	}, []);

	const abort = useCallback(() => {
		cbRef.current?.abort?.();
		cbRef.current = undefined;
	}, []);

	const wait = useCallback(() => {
		return new Promise<T>((resolve, reject) => {
			cbRef.current = {
				done: resolve,
				abort: reject,
			};
		});
	}, []);

	return {
		wait,
		done,
		abort,
	};
};
