import { GraphQLClient, Variables, RequestOptions } from "graphql-request";
import { RequestConfig } from "graphql-request/src/types";
import {DeepResolved, KeyOf, RootStore, RootStoreObjectTypes} from "./RootStore";

export type CachePolicy = "no-cache" | "cache-first" | "cache-only" | "network-only" | "cache-and-network";

export type DepotGQLClientInit = {
  /**
   * The cache policy to use for all requests. **Defaults to `"cache-and-network"`**
   *
   * - `"cache-first"`: Use cache if available, avoid network request if possible
   * - `"cache-only"`: Use cache if available, or error if this request was not made before
   * - `"cache-and-network"`: Use cache, but still send request and update cache in the background
   * - `"network-only"`: Skip cache, but cache the result
   * - `"no-cache"`: Skip cache, and don't cache the response either
   */
  defaultCachePolicy?: CachePolicy;
}

type Callbacks<ObjectTypes extends RootStoreObjectTypes, Typename extends KeyOf<ObjectTypes>> = {
  afterResolve: Callback<ObjectTypes, Typename>[];
}

interface Query {
  document: string;
  variables?: Record<string, unknown>;
}

type CallbackPayload<ObjectTypes extends RootStoreObjectTypes, Typename extends KeyOf<ObjectTypes>> = {
  resolved: DeepResolved<ObjectTypes, Typename, object>;
  query: Query;
}

type Callback<ObjectTypes extends RootStoreObjectTypes, Typename extends KeyOf<ObjectTypes>>
  = (payload: CallbackPayload<ObjectTypes, Typename>) => void;

type CallbackName = keyof Callbacks<any, any>;

/**
 * A wrapper around GraphQLClient from `graphql-request` that adds a cache layer.
 */
export class DepotGQLClient<ObjectTypes extends RootStoreObjectTypes, Typename extends KeyOf<ObjectTypes> = KeyOf<ObjectTypes>> {
  cache: [string, any][] = [];
  gqlClient: GraphQLClient;
  defaultCachePolicy: CachePolicy;
  rootStore = new RootStore<ObjectTypes>();
  callbacks: Callbacks<ObjectTypes, Typename> = {
    afterResolve: []
  };

  constructor(url: string, options: DepotGQLClientInit & RequestConfig = {}) {
    this.defaultCachePolicy = options.defaultCachePolicy || "cache-and-network";

    // Make sure not to pass unused options to GraphQLClient
    delete options.defaultCachePolicy;
    this.gqlClient = new GraphQLClient(url, options);
  }

  on(callbackName: CallbackName, callback: Callback<ObjectTypes, Typename>) {
    this.callbacks[callbackName].push(callback);

    return () => {
      this.callbacks[callbackName].splice(this.callbacks[callbackName].indexOf(callback), 1);
    }
  }

  emit(callbackName: CallbackName, resolved: DeepResolved<ObjectTypes, Typename, object>, query: Query) {
    this.callbacks[callbackName].forEach(callback => callback({ resolved, query }));
  }

  async *request<T extends {} = {}, V extends Variables = Variables>(
    options: RequestOptions<V, T> & { cachePolicy?: CachePolicy },
  ) {
    const { document, variables, cachePolicy = this.defaultCachePolicy } = options;

    const query = typeof document === "string" ? document : document.loc?.source.body;
    if (!query) throw new Error("No query found in document");

    const cacheKey = this.getCacheKey(query, variables);

    if (this.policyAllowsHit(cachePolicy)) {
      const cacheHit = this.getCachedResponse<DeepResolved<ObjectTypes, Typename, T>>(cacheKey);

      if (cacheHit) {
        yield cacheHit;

        // Avoid network request if cache was hit
        if (cachePolicy === 'cache-first') {
          return;
        }
      } else if (cachePolicy === 'cache-only') {
        // TODO: Better error here
        throw new Error(`Cache missed for operation ${document}`);
      }
    }

    if (this.policyAllowsNetwork(cachePolicy)) {
      const result = await this.gqlClient.request<T, V>(options);
      const resolved = this.rootStore.resolve(result);

      if (this.policyAllowsStore(cachePolicy)) {
        this.cacheResponse(cacheKey, resolved);
      }

      yield resolved;

      this.emit('afterResolve', resolved, { document: query, variables });
    }
  }

  policyAllowsNetwork(cachePolicy: CachePolicy) {
    const policies: CachePolicy[] = ["no-cache", "cache-first", "cache-and-network", "network-only"];

    return policies.includes(cachePolicy);
  }

  cacheResponse(cacheKey: string, response: any) {
    const existingCacheHit = this.getCacheHit(cacheKey);
    if (existingCacheHit) {
      existingCacheHit[1] = response;
      return;
    }

    this.cache.push([cacheKey, response]);
  }

  policyAllowsStore(cachePolicy: CachePolicy) {
    const policies: CachePolicy[] = ["cache-first", "cache-and-network", "network-only"];

    return policies.includes(cachePolicy);
  }

  policyAllowsHit(cachePolicy: CachePolicy) {
    const policies: CachePolicy[] = ["cache-first", "cache-only", "cache-and-network"];

    return policies.includes(cachePolicy);
  }

  getCacheKey(query: string, variables?: Variables) {
    return JSON.stringify({ query, variables });
  }

  getCachedResponse<T>(cacheKey: string): T | null {
    return this.getCacheHit<T>(cacheKey)?.[1] || null;
  }

  getCacheHit<T>(cacheKey: string): [string, T] | null {
    return this.cache.find(([key]) => key === cacheKey) || null;
  }
}