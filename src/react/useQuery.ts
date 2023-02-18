import {useState} from "react";

// TODO: Better types
interface IQuery {
  data: unknown;
  loading: boolean;
  setArgs: (...args: any[]) => void;
  queryPromise: Promise<unknown> | null;
  query: () => Promise<unknown>;
}

/**
 * @param generate A function that returns a `Query` instance.
 */
export function useQuery<Query extends IQuery, Data extends Exclude<Query['data'], null>>(generate: () => Query) {
  const [query, setQuery] = useState<Query | null>(null);

  const dispatch = async (): Promise<Data> => {
    const newQuery = generate();

    setQuery(newQuery);

    if (newQuery.queryPromise) {
      // If the Query is already in progress, await its promise
      return await newQuery.queryPromise as Data;
    }

    // Automatically mutate if the generate function didn't call it already.
    // Is this reliable? :shrug:
    return await newQuery.query() as Data;
  }

  return {
    dispatch,
    // TODO: Better types
    data: (query?.data || null) as Data | null,
    loading: query?.loading || false,
    query,
  }
}