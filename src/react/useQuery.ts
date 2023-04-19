import {useEffect, useState} from "react";

// TODO: Better types
interface IQuery {
  data: unknown;
  loading: boolean;
  error: Error | null;
  promise: Promise<unknown> | null;
  dispatch: () => Promise<unknown>;
}

interface IQueryWithVariables<Variables = any> extends IQuery {
  variables: Variables
  dispatch: (variables?: Variables) => Promise<unknown>;
}

export type UseQueryOpts<Data> = {
  lazy?: boolean;
  onSuccess?: (data: Data) => void;
}
/**
 * @param generate A function that returns a `Query` instance.
 */
export function useQuery<Query extends IQuery | IQueryWithVariables, Data extends Exclude<Query['data'], null>>(
  generate: () => Query,
  opts: UseQueryOpts<Data> = {},
) {
  const { lazy = false } = opts;
  const [query, setQuery] = useState<Query | null>(null);

  const dispatch = async (variables?: Query extends IQueryWithVariables ? Exclude<Query['variables'], null> : never): Promise<Data> => {
    const newQuery = generate();

    setQuery(newQuery);

    let data: Data;

    if (newQuery.promise) {
      // If the Query is already in progress, await its promise
      data = await newQuery.promise as Data;
    } else {
      // Automatically mutate if the generate function didn't call it already.
      // Is this reliable? :shrug:
      data = await newQuery.dispatch(variables) as Data;
    }

    opts.onSuccess?.(data);

    return data;
  }

  useEffect(() => {
    if (lazy) return;

    dispatch();
  }, [lazy]);

  return {
    dispatch,
    // TODO: Better types
    data: (query?.data || null) as Data | null,
    loading: query?.loading || false,
    error: query?.error || null,
    query,
  }
}