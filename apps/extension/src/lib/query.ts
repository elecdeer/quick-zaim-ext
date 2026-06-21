import { atom, type Atom, createStore } from "jotai";
import { useAtomValue } from "jotai/react";
import { atomFamily } from "jotai/utils";
import { useMemo } from "react";

interface QueryFnOpts {
  signal: AbortSignal;
}

const DEFAULT_GC_TIME = 5 * 60 * 1000;

interface DefineQueryOptions<TParams, TData> {
  /** データ取得関数 */
  queryFn: (params: TParams, opts: QueryFnOpts) => Promise<TData>;
  /** パラメータからキャッシュキーを生成（デフォルト: JSON.stringify） */
  getKey?: (params: TParams) => string;
  /** 未購読のキャッシュを破棄するまでの時間 (ms)。デフォルト: 5分 */
  gcTime?: number;
}

interface Queryable<TParams, TData> {
  /** パラメータを束縛する */
  with: (params: TParams) => BoundQuery<TData>;
  /** 射影する */
  select: <S>(selector: (data: TData) => S) => Queryable<TParams, S>;
}

export interface QueryStore<TParams, TData> extends Queryable<TParams, TData> {
  /** 命令的に prefetch する */
  prefetch: (params: TParams) => Promise<TData>;
  /** キャッシュを無効化する */
  invalidate: (params: TParams) => void;
  /** 全キャッシュを無効化する */
  invalidateAll: () => void;
  /** キャッシュ済みデータを同期的に取得 */
  getData: (params: TParams) => TData | undefined;
  /** Jotai atom としてアクセス（合成用）。キャッシュ未取得時は Promise を返す。 */
  atom: (params: TParams) => Atom<TData | Promise<TData>>;
}

export interface BoundQuery<TData> {
  /** 射影する */
  select: <S>(selector: (data: TData) => S) => BoundQuery<S>;
  /** prefetch する */
  prefetch: () => Promise<TData>;
  /** キャッシュ済みデータを同期的に取得 */
  getData: () => TData | undefined;
  /** キャッシュを無効化する */
  invalidate: () => void;
}

interface SuspenseQueryResult<TData> {
  /** 取得済みデータ（常に TData） */
  data: TData;
  /** バックグラウンドで再取得する。Promise を返す。 */
  refetch: () => Promise<TData>;
}

// --- Internal symbols ---

const QUERY_INTERNALS = Symbol("queryInternals");

interface QueryInternals<TData> {
  /** useAtomValue + transform を呼び出す（hook 内でのみ使用可） */
  useData: () => TData;
  /** バックグラウンドで再取得する */
  forceFetch: () => Promise<TData>;
}

interface HasInternals<TData> {
  [QUERY_INTERNALS]: QueryInternals<TData>;
}

/**
 * クエリ定義を作成する。
 */
export const defineQuery = <TParams, TData>(
  options: DefineQueryOptions<TParams, TData>,
): QueryStore<TParams, TData> => {
  const {
    queryFn,
    getKey = (params) => JSON.stringify(params),
    gcTime = DEFAULT_GC_TIME,
  } = options;

  const jotaiStore = createStore();
  const pendingFetches = new Map<string, Promise<TData>>();
  const gcTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const usedParams = new Map<string, TParams>();

  /** キャッシュデータを保持する writable atom（キーごと） */
  const cacheFamily = atomFamily(
    (_params: TParams) => atom<TData | undefined>(undefined),
    (a, b) => getKey(a) === getKey(b),
  );

  const cancelGcTimer = (key: string): void => {
    const timer = gcTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      gcTimers.delete(key);
    }
  };

  const startGcTimer = (key: string, params: TParams): void => {
    cancelGcTimer(key);
    gcTimers.set(
      key,
      setTimeout(() => {
        jotaiStore.set(cacheFamily(params), undefined);
        cacheFamily.remove(params);
        queryFamily.remove(params);
        usedParams.delete(key);
        gcTimers.delete(key);
      }, gcTime),
    );
  };

  const ensureFetch = (key: string, params: TParams): Promise<TData> => {
    const cached = jotaiStore.get(cacheFamily(params));
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = pendingFetches.get(key);
    if (pending) return pending;
    usedParams.set(key, params);
    const controller = new AbortController();
    const promise = queryFn(params, { signal: controller.signal }).then((data) => {
      jotaiStore.set(cacheFamily(params), data);
      pendingFetches.delete(key);
      return data;
    });
    pendingFetches.set(key, promise);
    return promise;
  };

  const forceFetchInternal = (key: string, params: TParams): Promise<TData> => {
    pendingFetches.delete(key);
    usedParams.set(key, params);
    const controller = new AbortController();
    const promise = queryFn(params, { signal: controller.signal }).then((data) => {
      jotaiStore.set(cacheFamily(params), data);
      pendingFetches.delete(key);
      return data;
    });
    pendingFetches.set(key, promise);
    return promise;
  };

  /** クエリ atom（キーごと）。cacheFamily に依存し、キャッシュミス時に fetch を起動する。 */
  const queryFamily = atomFamily(
    (params: TParams) => {
      const key = getKey(params);
      let mountCount = 0;
      const queryAtom = atom(
        (get): TData | Promise<TData> => {
          const cached = get(cacheFamily(params));
          if (cached !== undefined) return cached;
          // 外部 store からの読み取り用: 内部 store のキャッシュをフォールバック参照
          const privateCached = jotaiStore.get(cacheFamily(params));
          if (privateCached !== undefined) return privateCached;
          return ensureFetch(key, params);
        },
        () => {},
      );
      queryAtom.onMount = () => {
        mountCount++;
        cancelGcTimer(key);
        return () => {
          mountCount--;
          if (mountCount <= 0) startGcTimer(key, params);
        };
      };
      return queryAtom;
    },
    (a, b) => getKey(a) === getKey(b),
  );

  const prefetch = async (params: TParams): Promise<TData> => {
    const cached = jotaiStore.get(cacheFamily(params));
    if (cached !== undefined) return cached;
    return ensureFetch(getKey(params), params);
  };

  const getData = (params: TParams): TData | undefined => {
    return jotaiStore.get(cacheFamily(params));
  };

  const invalidate = (params: TParams): void => {
    cancelGcTimer(getKey(params));
    jotaiStore.set(cacheFamily(params), undefined);
  };

  const invalidateAll = (): void => {
    for (const [key, params] of usedParams) {
      cancelGcTimer(key);
      jotaiStore.set(cacheFamily(params), undefined);
    }
    usedParams.clear();
  };

  const makeInternals = <S>(params: TParams, transform: (data: TData) => S): QueryInternals<S> => {
    const key = getKey(params);
    const queryAtom = queryFamily(params);
    return {
      useData: () => transform(useAtomValue(queryAtom, { store: jotaiStore })),
      forceFetch: () => forceFetchInternal(key, params).then(transform),
    };
  };

  const makeBoundQuery = <S>(
    params: TParams,
    transform: (data: TData) => S,
  ): BoundQuery<S> & HasInternals<S> => ({
    [QUERY_INTERNALS]: makeInternals(params, transform),
    select: <S2>(selector: (data: S) => S2): BoundQuery<S2> =>
      makeBoundQuery(params, (d) => selector(transform(d))),
    prefetch: async () => transform(await prefetch(params)),
    getData: () => {
      const d = jotaiStore.get(cacheFamily(params));
      return d !== undefined ? transform(d) : undefined;
    },
    invalidate: () => invalidate(params),
  });

  const withParams = (params: TParams): BoundQuery<TData> => makeBoundQuery(params, (d) => d);

  const selectFn = <S>(selector: (data: TData) => S): Queryable<TParams, S> => ({
    with: (params: TParams) => makeBoundQuery(params, (d) => selector(d)),
    select: <S2>(s2: (data: S) => S2) => selectFn((d) => s2(selector(d))),
  });

  const result: QueryStore<TParams, TData> & HasInternals<TData> = {
    [QUERY_INTERNALS]: null as never,
    prefetch,
    invalidate,
    invalidateAll,
    getData,
    with: withParams,
    select: selectFn,
    atom: (params: TParams): Atom<TData | Promise<TData>> => queryFamily(params),
  };

  return result;
};

// --- Helpers ---

const getInternals = <TData>(
  queryOrBound: QueryStore<unknown, TData> | BoundQuery<TData> | Queryable<unknown, TData>,
  params?: unknown,
): QueryInternals<TData> => {
  const obj = queryOrBound as Partial<HasInternals<TData>>;
  if (obj[QUERY_INTERNALS]) {
    return obj[QUERY_INTERNALS] as QueryInternals<TData>;
  }
  const q = queryOrBound as QueryStore<unknown, TData>;
  const bound = q.with(params) as BoundQuery<TData> & HasInternals<TData>;
  return bound[QUERY_INTERNALS];
};

// --- Hook ---

/**
 * Suspense-first でクエリデータを取得する hook。
 */
export function useSuspenseQuery<TData>(query: BoundQuery<TData>): SuspenseQueryResult<TData>;
export function useSuspenseQuery<TParams, TData>(
  query: QueryStore<TParams, TData> | Queryable<TParams, TData>,
  params: TParams,
): SuspenseQueryResult<TData>;
export function useSuspenseQuery<TData>(
  query: QueryStore<unknown, TData> | BoundQuery<TData> | Queryable<unknown, TData>,
  params?: unknown,
): SuspenseQueryResult<TData> {
  const internals = useMemo(() => getInternals(query, params), [query, params]);
  const data = internals.useData();
  const refetch = useMemo(() => internals.forceFetch, [internals]);

  return { data, refetch };
}
