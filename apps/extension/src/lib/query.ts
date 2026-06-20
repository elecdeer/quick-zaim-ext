import { atom, type Atom } from "jotai";
import { useCallback, useEffect, useReducer } from "react";

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
  getKey: () => string;
  getData: () => TData | undefined;
  ensureFetch: () => Promise<TData>;
  forceFetch: () => Promise<TData>;
  subscribe: (callback: () => void) => () => void;
}

interface HasInternals<TData> {
  [QUERY_INTERNALS]: QueryInternals<TData>;
}

// --- Cache entry ---

interface CacheEntry<TData> {
  data: TData;
  fetchedAt: number;
  gcTimer: ReturnType<typeof setTimeout> | null;
  subscriberCount: number;
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
  const cache = new Map<string, CacheEntry<TData>>();
  const jotaiAtoms = new Map<string, Atom<TData | Promise<TData>>>();
  const pendingFetches = new Map<string, Promise<TData>>();
  const listeners = new Map<string, Set<() => void>>();

  const notify = (key: string): void => {
    const set = listeners.get(key);
    if (!set) return;
    for (const cb of set) cb();
  };

  const subscribe = (key: string, callback: () => void): (() => void) => {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(callback);

    const entry = cache.get(key);
    if (entry) {
      entry.subscriberCount++;
      cancelGcTimer(key);
    }

    return () => {
      set.delete(callback);
      if (set.size === 0) listeners.delete(key);

      const e = cache.get(key);
      if (e) {
        e.subscriberCount--;
        if (e.subscriberCount <= 0) {
          startGcTimer(key);
        }
      }
    };
  };

  const ensureFetch = (key: string, params: TParams): Promise<TData> => {
    const pending = pendingFetches.get(key);
    if (pending) return pending;

    const controller = new AbortController();
    const promise = queryFn(params, { signal: controller.signal }).then((data) => {
      cache.set(key, {
        data,
        fetchedAt: Date.now(),
        gcTimer: null,
        subscriberCount: cache.get(key)?.subscriberCount ?? 0,
      });
      pendingFetches.delete(key);
      notify(key);
      return data;
    });
    pendingFetches.set(key, promise);
    return promise;
  };

  const forceFetch = (key: string, params: TParams): Promise<TData> => {
    pendingFetches.delete(key);
    const controller = new AbortController();
    const promise = queryFn(params, { signal: controller.signal }).then((data) => {
      cache.set(key, {
        data,
        fetchedAt: Date.now(),
        gcTimer: null,
        subscriberCount: cache.get(key)?.subscriberCount ?? 0,
      });
      pendingFetches.delete(key);
      notify(key);
      return data;
    });
    pendingFetches.set(key, promise);
    return promise;
  };

  const prefetch = async (params: TParams): Promise<TData> => {
    const key = getKey(params);
    const existing = cache.get(key);
    if (existing) return existing.data;
    return ensureFetch(key, params);
  };

  const getData = (params: TParams): TData | undefined => {
    const key = getKey(params);
    return cache.get(key)?.data;
  };

  const removeCacheEntry = (key: string): void => {
    const entry = cache.get(key);
    if (entry?.gcTimer) clearTimeout(entry.gcTimer);
    cache.delete(key);
  };

  const invalidate = (params: TParams): void => {
    const key = getKey(params);
    removeCacheEntry(key);
    notify(key);
  };

  const invalidateAll = (): void => {
    for (const [key, entry] of cache.entries()) {
      if (entry.gcTimer) clearTimeout(entry.gcTimer);
      notify(key);
    }
    cache.clear();
  };

  const startGcTimer = (key: string): void => {
    const entry = cache.get(key);
    if (!entry) return;
    if (entry.gcTimer) clearTimeout(entry.gcTimer);
    entry.gcTimer = setTimeout(() => {
      removeCacheEntry(key);
    }, gcTime);
  };

  const cancelGcTimer = (key: string): void => {
    const entry = cache.get(key);
    if (!entry?.gcTimer) return;
    clearTimeout(entry.gcTimer);
    entry.gcTimer = null;
  };

  const atomFn = (params: TParams): Atom<TData | Promise<TData>> => {
    const key = getKey(params);
    const existing = jotaiAtoms.get(key);
    if (existing) return existing;

    const subscriberAtom = atom(0);
    subscriberAtom.onMount = (_set) => {
      const entry = cache.get(key);
      if (entry) {
        entry.subscriberCount++;
        cancelGcTimer(key);
      }
      return () => {
        const e = cache.get(key);
        if (e) {
          e.subscriberCount--;
          if (e.subscriberCount <= 0) {
            startGcTimer(key);
          }
        }
      };
    };

    const baseAtom = atom((get) => {
      get(subscriberAtom);
      const entry = cache.get(key);
      if (entry) return entry.data;
      return ensureFetch(key, params);
    });

    jotaiAtoms.set(key, baseAtom);
    return baseAtom;
  };

  const makeInternals = <S>(params: TParams, transform: (data: TData) => S): QueryInternals<S> => {
    const key = getKey(params);
    return {
      getKey: () => key,
      getData: () => {
        const d = getData(params);
        return d !== undefined ? transform(d) : undefined;
      },
      ensureFetch: () => ensureFetch(key, params).then(transform),
      forceFetch: () => forceFetch(key, params).then(transform),
      subscribe: (callback) => subscribe(key, callback),
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
      const d = getData(params);
      return d !== undefined ? transform(d) : undefined;
    },
    invalidate: () => invalidate(params),
  });

  const withParams = (params: TParams): BoundQuery<TData> => makeBoundQuery(params, (d) => d);

  const selectFn = <S>(selector: (data: TData) => S): Queryable<TParams, S> => {
    return {
      with: (params: TParams) => makeBoundQuery(params, (d) => selector(d)),
      select: <S2>(s2: (data: S) => S2) => selectFn((d) => s2(selector(d))),
    };
  };

  const store: QueryStore<TParams, TData> & HasInternals<TData> = {
    [QUERY_INTERNALS]: null as never, // placeholder, set per-call in useSuspenseQuery
    prefetch,
    invalidate,
    invalidateAll,
    getData,
    with: withParams,
    select: selectFn,
    atom: atomFn,
  };

  return store;
};

// --- Helpers ---

const getInternals = <TData>(
  queryOrBound: QueryStore<unknown, TData> | BoundQuery<TData> | Queryable<unknown, TData>,
  params?: unknown,
): QueryInternals<TData> => {
  const obj = queryOrBound as Partial<HasInternals<TData>>;
  if (obj[QUERY_INTERNALS] && (obj[QUERY_INTERNALS] as QueryInternals<TData>).getKey) {
    return obj[QUERY_INTERNALS] as QueryInternals<TData>;
  }
  // QueryStore + params case: create a BoundQuery to get internals
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
  const internals = getInternals(query, params);
  const key = internals.getKey();
  const [, forceUpdate] = useReducer((c: number) => c + 1, 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- internals is recreated each render; key is the stable identity
  useEffect(() => {
    return internals.subscribe(forceUpdate);
  }, [key]);

  const data = internals.getData();

  if (data === undefined) {
    throw internals.ensureFetch();
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- same as above
  const refetch = useCallback(async (): Promise<TData> => internals.forceFetch(), [key]);

  return { data, refetch };
}
