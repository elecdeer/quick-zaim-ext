import { createStore } from "jotai";
import { Suspense, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { type BoundQuery, defineQuery, useSuspenseQuery } from "./query";

describe("defineQuery", () => {
  it("returns a QueryStore object", () => {
    const query = defineQuery({
      queryFn: async () => "hello",
    });

    expect(query).toBeDefined();
    expect(typeof query.prefetch).toBe("function");
    expect(typeof query.invalidate).toBe("function");
    expect(typeof query.invalidateAll).toBe("function");
    expect(typeof query.getData).toBe("function");
    expect(typeof query.with).toBe("function");
    expect(typeof query.select).toBe("function");
    expect(typeof query.atom).toBe("function");
  });
});

describe("QueryStore.prefetch", () => {
  it("fetches data and makes it available via getData", async () => {
    const queryFn = vi.fn<(params: { id: string }) => Promise<{ name: string }>>(async (params) => {
      return { name: `user-${params.id}` };
    });

    const query = defineQuery({ queryFn });

    const result = await query.prefetch({ id: "1" });

    expect(result).toEqual({ name: "user-1" });
    expect(query.getData({ id: "1" })).toEqual({ name: "user-1" });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("passes AbortSignal to queryFn", async () => {
    const queryFn = vi.fn<
      (params: { id: string }, opts: { signal: AbortSignal }) => Promise<string>
    >(async (_params, { signal }) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return "ok";
    });

    const query = defineQuery({ queryFn });
    await query.prefetch({ id: "1" });

    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("caches results per params key", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async (params: { id: string }) => {
        callCount++;
        return `data-${params.id}`;
      },
    });

    await query.prefetch({ id: "1" });
    await query.prefetch({ id: "1" });
    await query.prefetch({ id: "2" });

    expect(callCount).toBe(2);
    expect(query.getData({ id: "1" })).toBe("data-1");
    expect(query.getData({ id: "2" })).toBe("data-2");
  });
});

describe("QueryStore.getData", () => {
  it("returns undefined when no cache exists", () => {
    const query = defineQuery({
      queryFn: async () => "data",
    });

    expect(query.getData(undefined)).toBeUndefined();
  });
});

describe("defineQuery isolation", () => {
  it("different defineQuery instances do not share cache", async () => {
    const queryA = defineQuery({
      queryFn: async () => "data-a",
    });
    const queryB = defineQuery({
      queryFn: async () => "data-b",
    });

    await queryA.prefetch(undefined);

    expect(queryA.getData(undefined)).toBe("data-a");
    expect(queryB.getData(undefined)).toBeUndefined();
  });

  it("invalidate on one does not affect the other", async () => {
    const queryA = defineQuery({
      queryFn: async (params: { id: string }) => `a-${params.id}`,
    });
    const queryB = defineQuery({
      queryFn: async (params: { id: string }) => `b-${params.id}`,
    });

    await queryA.prefetch({ id: "1" });
    await queryB.prefetch({ id: "1" });

    queryA.invalidateAll();

    expect(queryA.getData({ id: "1" })).toBeUndefined();
    expect(queryB.getData({ id: "1" })).toBe("b-1");
  });
});

describe("QueryStore.invalidate", () => {
  it("removes cached data for given params", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    await query.prefetch({ id: "1" });
    await query.prefetch({ id: "2" });

    query.invalidate({ id: "1" });

    expect(query.getData({ id: "1" })).toBeUndefined();
    expect(query.getData({ id: "2" })).toBe("data-2");
  });

  it("causes next prefetch to re-fetch", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async (params: { id: string }) => {
        callCount++;
        return `data-${params.id}-${callCount}`;
      },
    });

    await query.prefetch({ id: "1" });
    expect(query.getData({ id: "1" })).toBe("data-1-1");

    query.invalidate({ id: "1" });
    await query.prefetch({ id: "1" });

    expect(callCount).toBe(2);
    expect(query.getData({ id: "1" })).toBe("data-1-2");
  });
});

describe("QueryStore.invalidateAll", () => {
  it("removes all cached data", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    await query.prefetch({ id: "1" });
    await query.prefetch({ id: "2" });

    query.invalidateAll();

    expect(query.getData({ id: "1" })).toBeUndefined();
    expect(query.getData({ id: "2" })).toBeUndefined();
  });
});

describe("QueryStore.with", () => {
  it("returns a BoundQuery with bound params", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({ name: `user-${params.id}` }),
    });

    const bound = query.with({ id: "1" });

    const result = await bound.prefetch();
    expect(result).toEqual({ name: "user-1" });
    expect(bound.getData()).toEqual({ name: "user-1" });
  });

  it("shares cache with QueryStore", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    await query.prefetch({ id: "1" });
    const bound = query.with({ id: "1" });

    expect(bound.getData()).toBe("data-1");
  });

  it("invalidate on BoundQuery invalidates the same cache entry", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    await query.prefetch({ id: "1" });
    const bound = query.with({ id: "1" });

    bound.invalidate();
    expect(query.getData({ id: "1" })).toBeUndefined();
  });
});

describe("QueryStore.select / BoundQuery.select", () => {
  it("select on BoundQuery transforms getData", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({
        name: `user-${params.id}`,
        age: 30,
      }),
    });

    await query.prefetch({ id: "1" });
    const selected = query.with({ id: "1" }).select((u) => u.name);

    expect(selected.getData()).toBe("user-1");
  });

  it("select on BoundQuery transforms prefetch result", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({
        name: `user-${params.id}`,
        age: 30,
      }),
    });

    const selected = query.with({ id: "1" }).select((u) => u.name);
    const result = await selected.prefetch();

    expect(result).toBe("user-1");
  });

  it("select on QueryStore then with", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({
        name: `user-${params.id}`,
        age: 30,
      }),
    });

    const nameQuery = query.select((u) => u.name);
    const bound = nameQuery.with({ id: "1" });

    const result = await bound.prefetch();
    expect(result).toBe("user-1");
    expect(bound.getData()).toBe("user-1");
  });

  it("chained select composes selectors", async () => {
    const query = defineQuery({
      queryFn: async () => ({
        profile: { name: "Alice", age: 30 },
      }),
    });

    const selected = query.select((u) => u.profile).select((p) => p.name);

    const bound = selected.with(undefined);
    const result = await bound.prefetch();

    expect(result).toBe("Alice");
  });
});

describe("getKey option", () => {
  it("uses custom getKey for cache key", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async (params: { id: string; _extra: number }) => {
        callCount++;
        return `data-${params.id}`;
      },
      getKey: (params) => params.id,
    });

    await query.prefetch({ id: "1", _extra: 100 });
    await query.prefetch({ id: "1", _extra: 200 });

    expect(callCount).toBe(1);
  });
});

describe("QueryStore.atom", () => {
  it("returns cached data synchronously when prefetched (async sometimes)", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    await query.prefetch({ id: "1" });

    const store = createStore();
    const a = query.atom({ id: "1" });
    const value = store.get(a);

    expect(value).toBe("data-1");
  });

  it("returns a Promise when no cache exists (triggers Suspense)", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    const store = createStore();
    const a = query.atom({ id: "1" });
    const value = store.get(a);

    expect(value).toBeInstanceOf(Promise);
    expect(await value).toBe("data-1");
  });

  it("populates cache after atom Promise resolves", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    const store = createStore();
    const a = query.atom({ id: "1" });
    await store.get(a);

    expect(query.getData({ id: "1" })).toBe("data-1");
  });

  it("returns same atom instance for same params", () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    const a1 = query.atom({ id: "1" });
    const a2 = query.atom({ id: "1" });
    const a3 = query.atom({ id: "2" });

    expect(a1).toBe(a2);
    expect(a1).not.toBe(a3);
  });

  it("after invalidate, getData returns undefined and fresh store read returns Promise", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
    });

    await query.prefetch({ id: "1" });
    expect(query.getData({ id: "1" })).toBe("data-1");

    query.invalidate({ id: "1" });
    expect(query.getData({ id: "1" })).toBeUndefined();

    const freshStore = createStore();
    const a = query.atom({ id: "1" });
    const value = freshStore.get(a);
    expect(value).toBeInstanceOf(Promise);
  });
});

describe("gcTime", () => {
  it("removes cache entry after gcTime when no subscribers", async () => {
    vi.useFakeTimers();

    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
      gcTime: 1000,
    });

    await query.prefetch({ id: "1" });
    expect(query.getData({ id: "1" })).toBe("data-1");

    const store = createStore();
    const a = query.atom({ id: "1" });
    void store.get(a);

    const unsub = store.sub(a, () => {});
    unsub();

    vi.advanceTimersByTime(999);
    expect(query.getData({ id: "1" })).toBe("data-1");

    vi.advanceTimersByTime(1);
    expect(query.getData({ id: "1" })).toBeUndefined();

    vi.useRealTimers();
  });

  it("cancels gc timer when re-subscribed before expiry", async () => {
    vi.useFakeTimers();

    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
      gcTime: 1000,
    });

    await query.prefetch({ id: "1" });

    const store = createStore();
    const a = query.atom({ id: "1" });
    void store.get(a);

    const unsub1 = store.sub(a, () => {});
    unsub1();

    vi.advanceTimersByTime(500);

    const unsub2 = store.sub(a, () => {});
    vi.advanceTimersByTime(600);
    expect(query.getData({ id: "1" })).toBe("data-1");

    unsub2();
    vi.advanceTimersByTime(1000);
    expect(query.getData({ id: "1" })).toBeUndefined();

    vi.useRealTimers();
  });

  it("manages gc timers independently per key", async () => {
    vi.useFakeTimers();

    const query = defineQuery({
      queryFn: async (params: { id: string }) => `data-${params.id}`,
      gcTime: 1000,
    });

    await query.prefetch({ id: "1" });
    await query.prefetch({ id: "2" });

    const store = createStore();
    const a1 = query.atom({ id: "1" });
    const a2 = query.atom({ id: "2" });
    void store.get(a1);
    void store.get(a2);

    const unsub1 = store.sub(a1, () => {});
    const unsub2 = store.sub(a2, () => {});

    unsub1();
    vi.advanceTimersByTime(500);

    unsub2();
    vi.advanceTimersByTime(500);

    expect(query.getData({ id: "1" })).toBeUndefined();
    expect(query.getData({ id: "2" })).toBe("data-2");

    vi.advanceTimersByTime(500);
    expect(query.getData({ id: "2" })).toBeUndefined();

    vi.useRealTimers();
  });
});

describe("useSuspenseQuery", () => {
  it("suspends while loading, then renders data", async () => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const query = defineQuery({
      queryFn: async () => promise,
    });

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("loading")).toBeVisible();

    resolve("hello");

    await expect.element(page.getByTestId("result")).toHaveTextContent("hello");
  });

  it("renders immediately when data is prefetched (async sometimes)", async () => {
    const queryFn = vi.fn<() => Promise<string>>(async () => "prefetched");
    const query = defineQuery({ queryFn });

    await query.prefetch(undefined);
    expect(queryFn).toHaveBeenCalledOnce();

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("prefetched");
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("refetch returns new data and re-renders", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async () => {
        callCount++;
        return `data-${callCount}`;
      },
    });

    let refetchFn!: () => Promise<string>;

    const Inner = () => {
      const { data, refetch } = useSuspenseQuery(query, undefined);
      refetchFn = refetch;
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("data-1");

    const newData = await refetchFn();
    expect(newData).toBe("data-2");

    await expect.element(page.getByTestId("result")).toHaveTextContent("data-2");
  });

  it("works with BoundQuery via .with()", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({
        name: `user-${params.id}`,
        age: 30,
      }),
    });

    const bound = query.with({ id: "1" });

    const Inner = ({ q }: { q: typeof bound }) => {
      const { data } = useSuspenseQuery(q);
      return <div data-testid="result">{data.name}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner q={bound} />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("user-1");
  });

  it("works with BoundQuery.select()", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({
        name: `user-${params.id}`,
        age: 30,
      }),
    });

    const nameQuery = query.with({ id: "1" }).select((u) => u.name);

    const Inner = ({ q }: { q: BoundQuery<string> }) => {
      const { data } = useSuspenseQuery(q);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner q={nameQuery} />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("user-1");
  });

  it("works with QueryStore.select().with()", async () => {
    const query = defineQuery({
      queryFn: async (params: { id: string }) => ({
        name: `user-${params.id}`,
        age: 30,
      }),
    });

    const nameQuery = query.select((u) => u.name);
    const bound = nameQuery.with({ id: "1" });

    const Inner = ({ q }: { q: BoundQuery<string> }) => {
      const { data } = useSuspenseQuery(q);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner q={bound} />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("user-1");
  });

  it("data and refetch are referentially stable across re-renders (BoundQuery)", async () => {
    const query = defineQuery({
      queryFn: async () => ({ name: "Alice" }),
    });

    await query.prefetch(undefined);
    const bound = query.with(undefined);

    const dataRefs: Array<{ name: string }> = [];
    const refetchRefs: Array<() => Promise<{ name: string }>> = [];

    const Inner = () => {
      const { data, refetch } = useSuspenseQuery(bound);
      dataRefs.push(data);
      refetchRefs.push(refetch);
      const [count, setCount] = useState(0);
      return (
        <div>
          <div data-testid="result">{data.name}</div>
          <div data-testid="count">{count}</div>
          <button data-testid="rerender" onClick={() => setCount((n) => n + 1)} type="button">
            rerender
          </button>
        </div>
      );
    };

    await render(
      <Suspense fallback={<div>loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("Alice");

    await page.getByTestId("rerender").click();
    await expect.element(page.getByTestId("count")).toHaveTextContent("1");

    expect(dataRefs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < dataRefs.length; i++) {
      expect(dataRefs[i]).toBe(dataRefs[0]);
    }
    for (let i = 1; i < refetchRefs.length; i++) {
      expect(refetchRefs[i]).toBe(refetchRefs[0]);
    }
  });

  it("data and refetch are referentially stable across re-renders (QueryStore + params)", async () => {
    const query = defineQuery({
      queryFn: async (id: string) => ({ name: `user-${id}` }),
    });

    await query.prefetch("1");

    const dataRefs: Array<{ name: string }> = [];
    const refetchRefs: Array<() => Promise<{ name: string }>> = [];

    const Inner = () => {
      const { data, refetch } = useSuspenseQuery(query, "1");
      dataRefs.push(data);
      refetchRefs.push(refetch);
      const [count, setCount] = useState(0);
      return (
        <div>
          <div data-testid="result">{data.name}</div>
          <div data-testid="count">{count}</div>
          <button data-testid="rerender" onClick={() => setCount((n) => n + 1)} type="button">
            rerender
          </button>
        </div>
      );
    };

    await render(
      <Suspense fallback={<div>loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("user-1");

    await page.getByTestId("rerender").click();
    await expect.element(page.getByTestId("count")).toHaveTextContent("1");

    expect(dataRefs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < dataRefs.length; i++) {
      expect(dataRefs[i]).toBe(dataRefs[0]);
    }
    for (let i = 1; i < refetchRefs.length; i++) {
      expect(refetchRefs[i]).toBe(refetchRefs[0]);
    }
  });

  it("multiple components share cache and both update on refetch", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async () => {
        callCount++;
        return `data-${callCount}`;
      },
    });

    let refetchFn!: () => Promise<string>;

    const ComponentA = () => {
      const { data, refetch } = useSuspenseQuery(query, undefined);
      refetchFn = refetch;
      return <div data-testid="result-a">{data}</div>;
    };

    const ComponentB = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result-b">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <ComponentA />
        <ComponentB />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result-a")).toHaveTextContent("data-1");
    await expect.element(page.getByTestId("result-b")).toHaveTextContent("data-1");

    await refetchFn();

    await expect.element(page.getByTestId("result-a")).toHaveTextContent("data-2");
    await expect.element(page.getByTestId("result-b")).toHaveTextContent("data-2");
  });
});

describe("error handling", () => {
  it("queryFn error propagates to ErrorBoundary via Suspense", async () => {
    const query = defineQuery({
      queryFn: async () => {
        throw new Error("fetch failed");
      },
    });

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <ErrorBoundary fallback={(error) => <div data-testid="error">{error.message}</div>}>
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <Inner />
        </Suspense>
      </ErrorBoundary>,
    );

    await expect.element(page.getByTestId("error")).toHaveTextContent("fetch failed");
  });

  it("recovers from error via refetch and ErrorBoundary reset", async () => {
    const deferreds: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];

    const query = defineQuery({
      queryFn: async () =>
        new Promise<string>((resolve, reject) => {
          deferreds.push({ resolve, reject });
        }),
    });

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <ErrorBoundary
        fallback={(_error, reset) => (
          <button
            data-testid="retry"
            onClick={() => {
              void query.refetch(undefined);
              reset();
            }}
            type="button"
          >
            retry
          </button>
        )}
      >
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <Inner />
        </Suspense>
      </ErrorBoundary>,
    );

    await expect.element(page.getByTestId("loading")).toBeVisible();

    deferreds[0].reject(new Error("network error"));
    await expect.element(page.getByTestId("retry")).toBeVisible();

    await page.getByTestId("retry").click();
    await expect.element(page.getByTestId("loading")).toBeVisible();

    deferreds[1].resolve("recovered");
    await expect.element(page.getByTestId("result")).toHaveTextContent("recovered");
  });

  it("prefetch rejects when queryFn throws, getData returns undefined", async () => {
    const query = defineQuery({
      queryFn: async () => {
        throw new Error("prefetch error");
      },
    });

    await expect(query.prefetch(undefined)).rejects.toThrow("prefetch error");
    expect(query.getData(undefined)).toBeUndefined();
  });
});

describe("race conditions", () => {
  it("stale response for old params does not affect component with new params", async () => {
    const deferreds = new Map<string, { resolve: (v: string) => void }>();

    const query = defineQuery({
      queryFn: async (id: string) =>
        new Promise<string>((resolve) => {
          deferreds.set(id, { resolve });
        }),
    });

    const Inner = ({ id }: { id: string }) => {
      const { data } = useSuspenseQuery(query, id);
      return <div data-testid="result">{data}</div>;
    };

    const Wrapper = () => {
      const [id, setId] = useState("1");
      return (
        <>
          <button data-testid="switch" onClick={() => setId("2")} type="button">
            switch
          </button>
          <Suspense fallback={<div data-testid="loading">loading</div>}>
            <Inner id={id} />
          </Suspense>
        </>
      );
    };

    await render(<Wrapper />);
    await expect.element(page.getByTestId("loading")).toBeVisible();

    await page.getByTestId("switch").click();

    deferreds.get("1")?.resolve("stale-data");
    deferreds.get("2")?.resolve("current-data");

    await expect.element(page.getByTestId("result")).toHaveTextContent("current-data");
  });

  it("invalidate during in-flight refetch — refetch still populates cache", async () => {
    const deferreds: Array<{ resolve: (v: string) => void }> = [];

    const query = defineQuery({
      queryFn: async () =>
        new Promise<string>((resolve) => {
          deferreds.push({ resolve });
        }),
    });

    const initial = query.prefetch(undefined);
    deferreds[0].resolve("initial");
    await initial;
    expect(query.getData(undefined)).toBe("initial");

    const refetchPromise = query.refetch(undefined);

    query.invalidate(undefined);
    expect(query.getData(undefined)).toBeUndefined();

    deferreds[1].resolve("refreshed");
    await refetchPromise;

    expect(query.getData(undefined)).toBe("refreshed");
  });
});

describe("refetch behavior", () => {
  it("does not re-suspend while refetching", async () => {
    const deferreds: Array<{ resolve: (v: string) => void }> = [];

    const query = defineQuery({
      queryFn: async () =>
        new Promise<string>((resolve) => {
          deferreds.push({ resolve });
        }),
    });

    let refetchFn!: () => Promise<string>;

    const Inner = () => {
      const { data, refetch } = useSuspenseQuery(query, undefined);
      refetchFn = refetch;
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("loading")).toBeVisible();

    deferreds[0].resolve("initial");
    await expect.element(page.getByTestId("result")).toHaveTextContent("initial");

    const refetchPromise = refetchFn();

    await expect.element(page.getByTestId("result")).toHaveTextContent("initial");
    await expect.element(page.getByTestId("loading")).not.toBeInTheDocument();

    deferreds[1].resolve("updated");
    await refetchPromise;

    await expect.element(page.getByTestId("result")).toHaveTextContent("updated");
  });

  it("preserves existing cache on refetch failure", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async () => {
        callCount++;
        if (callCount === 1) return "initial";
        throw new Error("refetch failed");
      },
    });

    let refetchFn!: () => Promise<string>;

    const Inner = () => {
      const { data, refetch } = useSuspenseQuery(query, undefined);
      refetchFn = refetch;
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("initial");

    await expect(refetchFn()).rejects.toThrow("refetch failed");

    await expect.element(page.getByTestId("result")).toHaveTextContent("initial");
    expect(query.getData(undefined)).toBe("initial");
  });
});

describe("setData", () => {
  it("triggers immediate re-render of mounted component", async () => {
    const query = defineQuery({
      queryFn: async () => "initial",
    });

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div>loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("initial");

    query.setData(undefined, "updated-via-setData");

    await expect.element(page.getByTestId("result")).toHaveTextContent("updated-via-setData");
  });

  it("refetch after setData returns server data", async () => {
    let callCount = 0;
    const query = defineQuery({
      queryFn: async () => {
        callCount++;
        return `server-${callCount}`;
      },
    });

    let refetchFn!: () => Promise<string>;

    const Inner = () => {
      const { data, refetch } = useSuspenseQuery(query, undefined);
      refetchFn = refetch;
      return <div data-testid="result">{data}</div>;
    };

    await render(
      <Suspense fallback={<div>loading</div>}>
        <Inner />
      </Suspense>,
    );

    await expect.element(page.getByTestId("result")).toHaveTextContent("server-1");

    query.setData(undefined, "optimistic");
    await expect.element(page.getByTestId("result")).toHaveTextContent("optimistic");

    await refetchFn();
    await expect.element(page.getByTestId("result")).toHaveTextContent("server-2");
  });
});

describe("params change", () => {
  it("re-suspends when params change to uncached value", async () => {
    const deferreds = new Map<string, { resolve: (v: string) => void }>();

    const query = defineQuery({
      queryFn: async (id: string) =>
        new Promise<string>((resolve) => {
          deferreds.set(id, { resolve });
        }),
    });

    const Inner = ({ id }: { id: string }) => {
      const { data } = useSuspenseQuery(query, id);
      return <div data-testid="result">{data}</div>;
    };

    const Wrapper = () => {
      const [id, setId] = useState("1");
      return (
        <>
          <button data-testid="switch" onClick={() => setId("2")} type="button">
            switch
          </button>
          <Suspense fallback={<div data-testid="loading">loading</div>}>
            <Inner id={id} />
          </Suspense>
        </>
      );
    };

    await render(<Wrapper />);
    await expect.element(page.getByTestId("loading")).toBeVisible();

    deferreds.get("1")?.resolve("data-1");
    await expect.element(page.getByTestId("result")).toHaveTextContent("data-1");

    await page.getByTestId("switch").click();
    await expect.element(page.getByTestId("loading")).toBeVisible();

    deferreds.get("2")?.resolve("data-2");
    await expect.element(page.getByTestId("result")).toHaveTextContent("data-2");
  });

  it("does not re-suspend when params change to already-cached value", async () => {
    const queryFn = vi.fn<(id: string) => Promise<string>>(async (id) => `data-${id}`);
    const query = defineQuery({ queryFn });

    await query.prefetch("1");
    await query.prefetch("2");

    const Inner = ({ id }: { id: string }) => {
      const { data } = useSuspenseQuery(query, id);
      return <div data-testid="result">{data}</div>;
    };

    const Wrapper = () => {
      const [id, setId] = useState("1");
      return (
        <>
          <button data-testid="switch" onClick={() => setId("2")} type="button">
            switch
          </button>
          <Suspense fallback={<div data-testid="loading">loading</div>}>
            <Inner id={id} />
          </Suspense>
        </>
      );
    };

    await render(<Wrapper />);
    await expect.element(page.getByTestId("result")).toHaveTextContent("data-1");

    await page.getByTestId("switch").click();

    await expect.element(page.getByTestId("result")).toHaveTextContent("data-2");
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});

describe("mount/unmount", () => {
  it("fetch completes after component unmount and populates cache", async () => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const query = defineQuery({
      queryFn: async () => promise,
    });

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    const Wrapper = () => {
      const [show, setShow] = useState(true);
      return (
        <>
          <button data-testid="hide" onClick={() => setShow(false)} type="button">
            hide
          </button>
          {show && (
            <Suspense fallback={<div data-testid="loading">loading</div>}>
              <Inner />
            </Suspense>
          )}
        </>
      );
    };

    await render(<Wrapper />);
    await expect.element(page.getByTestId("loading")).toBeVisible();

    await page.getByTestId("hide").click();
    await expect.element(page.getByTestId("loading")).not.toBeInTheDocument();

    resolve("data-after-unmount");
    // ensureFetch の .then() チェーンがキャッシュを更新するまで待つ
    await new Promise((r) => setTimeout(r, 0));

    expect(query.getData(undefined)).toBe("data-after-unmount");
  });

  it("remount within gcTime uses cached data without refetch", async () => {
    const queryFn = vi.fn<() => Promise<string>>(async () => "cached-data");
    const query = defineQuery({ queryFn, gcTime: 60000 });

    const Inner = () => {
      const { data } = useSuspenseQuery(query, undefined);
      return <div data-testid="result">{data}</div>;
    };

    const Wrapper = () => {
      const [show, setShow] = useState(true);
      return (
        <>
          <button data-testid="toggle" onClick={() => setShow((s) => !s)} type="button">
            toggle
          </button>
          {show && (
            <Suspense fallback={<div data-testid="loading">loading</div>}>
              <Inner />
            </Suspense>
          )}
        </>
      );
    };

    await render(<Wrapper />);
    await expect.element(page.getByTestId("result")).toHaveTextContent("cached-data");
    expect(queryFn).toHaveBeenCalledOnce();

    await page.getByTestId("toggle").click();
    await expect.element(page.getByTestId("result")).not.toBeInTheDocument();

    await page.getByTestId("toggle").click();
    await expect.element(page.getByTestId("result")).toHaveTextContent("cached-data");
    expect(queryFn).toHaveBeenCalledOnce();
  });
});
