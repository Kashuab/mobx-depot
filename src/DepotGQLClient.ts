import { GraphQLClient, Variables, RequestOptions } from "graphql-request";
import { RequestConfig } from "graphql-request/src/types";

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

/**
 * A wrapper around GraphQLClient from `graphql-request` that adds a cache layer.
 */
export class DepotGQLClient {
  cache: [string, any][] = [];
  gqlClient: GraphQLClient;
  defaultCachePolicy: CachePolicy;

  constructor(url: string, options: DepotGQLClientInit & RequestConfig = {}) {
    this.defaultCachePolicy = options.defaultCachePolicy || "cache-and-network";

    // Make sure not to pass unused options to GraphQLClient
    delete options.defaultCachePolicy;
    this.gqlClient = new GraphQLClient(url, options);
  }

  async *request<T = any, V extends Variables = Variables>(
    options: RequestOptions<V, T> & { cachePolicy?: CachePolicy },
  ): AsyncGenerator<T> {
    const { document, variables, cachePolicy = this.defaultCachePolicy } = options;

    const query = typeof document === "string" ? document : document.loc?.source.body;
    if (!query) throw new Error("No query found in document");

    const cacheKey = this.getCacheKey(query, variables);

    if (this.policyAllowsHit(cachePolicy)) {
      const cacheHit = this.getCachedResponse<T>(cacheKey);

      if (cacheHit) {
        yield cacheHit;

        // Avoid network request if cache was hit
        if (cachePolicy === 'cache-first') return;
      } else if (cachePolicy === 'cache-only') {
        // TODO: Better error here
        throw new Error(`Cache missed for operation ${document}`);
      }
    }

    if (this.policyAllowsNetwork(cachePolicy)) {
      const result = await this.gqlClient.request<T, V>(options);

      if (this.policyAllowsStore(cachePolicy)) {
        this.cacheResponse(cacheKey, result);
      }

      yield result;
    }
  }

  policyAllowsNetwork(cachePolicy: CachePolicy) {
    const policies: CachePolicy[] = ["no-cache", "cache-first", "cache-and-network", "network-only"];

    return policies.includes(cachePolicy);
  }

  cacheResponse(cacheKey: string, response: any) {
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
    return this.cache.find(([key]) => key === cacheKey)?.[1] || null;
  }
}