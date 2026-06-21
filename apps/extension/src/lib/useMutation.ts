import { useCallback, useRef, useState } from "react";

interface MutationState<TData, TError = Error> {
  data: TData | undefined;
  error: TError | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}

interface MutationResult<TData, TVariables, TError = Error> extends MutationState<TData, TError> {
  /** 非同期で mutation を実行する（エラーは内部で catch） */
  mutate: (variables: TVariables) => void;
  /** 非同期で mutation を実行する（呼び出し元に Promise を返す） */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** 状態をリセットする */
  reset: () => void;
}

interface UseMutationOptions<TData, TVariables, TError = Error> {
  /** mutation 関数 */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** 成功時のコールバック */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  /** 失敗時のコールバック */
  onError?: (error: TError, variables: TVariables) => void;
}

const initialState = <TData, TError>(): MutationState<TData, TError> => ({
  data: undefined,
  error: null,
  isPending: false,
  isError: false,
  isSuccess: false,
});

/**
 * 軽量な mutation hook。
 */
export const useMutation = <TData, TVariables = void, TError = Error>(
  options: UseMutationOptions<TData, TVariables, TError>,
): MutationResult<TData, TVariables, TError> => {
  const [state, setState] = useState<MutationState<TData, TError>>(initialState);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setState({ data: undefined, error: null, isPending: true, isError: false, isSuccess: false });
    try {
      const data = await optionsRef.current.mutationFn(variables);
      setState({ data, error: null, isPending: false, isError: false, isSuccess: true });
      await optionsRef.current.onSuccess?.(data, variables);
      return data;
    } catch (error) {
      const typedError = error as TError;
      setState({
        data: undefined,
        error: typedError,
        isPending: false,
        isError: true,
        isSuccess: false,
      });
      optionsRef.current.onError?.(typedError, variables);
      throw error;
    }
  }, []);

  const mutate = useCallback(
    (variables: TVariables) => {
      void mutateAsync(variables).catch(() => {});
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { ...state, mutate, mutateAsync, reset };
};
