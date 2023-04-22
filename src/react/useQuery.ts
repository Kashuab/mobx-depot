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
 * A hook that manages the state of a given query.
 *
 * **Tip:** When using a method on a class that returns the query, don't pass it in directly. Use an arrow function:
 * `useQuery(() => user.findPosts())` instead of `useQuery(user.findPosts)` Otherwise, the context of `this` will be
 * lost, resulting in a runtime error.
 *
 * @param generate A function that returns a `Query` instance.
 */
export function useQuery<
  Query extends IQuery | IQueryWithVariables,
  Data = Exclude<Query['data'], null>,
  Variables = Query extends IQueryWithVariables ? Exclude<Query['variables'], null> : never
>(
  generate?: (() => Query) | null,
  opts: UseQueryOpts<Data> = {},
) {
  const { lazy = false } = opts;
  const [query, setQuery] = useState<Query | null>(null);

  const dispatch = async (
    variablesOrQuery?: Query | Variables,
  ): Promise<Data> => {
    let usableQuery = query;
    let variables: Variables | undefined;

    if (variablesOrQuery) {
      if (variablesOrQuery instanceof Object && 'dispatch' in variablesOrQuery) {
        usableQuery = variablesOrQuery
      } else {
        variables = variablesOrQuery;
      }
    } else if (generate) {
      usableQuery = generate();
    }

    if (!usableQuery) {
      throw new Error('No query provided');
    }

    setQuery(usableQuery);

    let data: Data;

    if (usableQuery.promise) {
      // If the query is already in progress, await its promise
      data = await usableQuery.promise as Data;
    } else {
      // Automatically mutate if the generate function didn't call it already.
      // Is this reliable? :shrug:
      data = await usableQuery.dispatch(variables) as Data;
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