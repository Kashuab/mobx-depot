import {useQuery} from "./useQuery";

// TODO: There's a lot of similarity between this and useQuery
interface IMutation {
  data: unknown;
  loading: boolean;
  error: Error | null;
  promise: Promise<unknown> | null;
  dispatch: () => Promise<unknown>;
}

interface IMutationWithVariables<Variables = any> extends IMutation {
  variables: Variables
  dispatch: (variables?: Variables) => Promise<unknown>;
}

export type UseMutationOpts<Data> = {
  onSuccess?: (data: Data) => void;
}

/**
 * Basically just `useQuery` that automatically sets `lazy` to `true`, with more intuitive language.
 *
 * When using a method on a class that returns the mutation, don't pass it in directly. Use an arrow function:
 * `useMutation(() => user.create())` instead of `useMutation(user.create)` Otherwise, the context of `this` will be
 * lost, resulting in a runtime error.
 *
 * @param generate A function that returns a `Mutation` instance.
 */
export function useMutation<
  Mutation extends IMutation | IMutationWithVariables,
  Data = Exclude<Mutation['data'], null>,
  Variables = Mutation extends IMutationWithVariables ? Exclude<Mutation['variables'], null> : never
>(
  generate?: (() => Mutation) | null,
  opts: UseMutationOpts<Data> = {},
) {
  const { dispatch, data, loading, error, query } = useQuery<Mutation, Data, Variables>(generate, {
    ...opts,
    lazy: true,
  });

  return {
    dispatch,
    // TODO: Better types
    data,
    loading,
    error,
    mutation: query,
  }
}