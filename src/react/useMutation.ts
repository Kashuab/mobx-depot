import {useState} from "react";

// TODO: Better types
interface IMutation {
  data: unknown;
  error: Error | null;
  loading: boolean;
  promise: Promise<unknown> | null;
  dispatch: () => Promise<unknown>;
}

type UseMutationOpts<Data> = {
  onSuccess?: (data: Data) => void;
}

/**
 * When using a method on a class that returns the mutation, don't pass it in directly. Use an arrow function:
 * `useMutation(() => user.create())` instead of `useMutation(user.create)` Otherwise, the context of `this` will be
 * lost, resulting in a runtime error.
 *
 * @param generate A function that returns a `Mutation` instance.
 */
export function useMutation<Mutation extends IMutation, Data extends Exclude<Mutation['data'], null>, GenerateArgs extends any[]>(
  generate: (...args: GenerateArgs) => Mutation,
  opts: UseMutationOpts<Data> = {},
) {
  const [mutation, setMutation] = useState<Mutation | null>(null);

  const dispatch = async (...args: GenerateArgs): Promise<Data> => {
    const newMutation = generate(...args);

    setMutation(newMutation);

    let data: Data;

    if (newMutation.promise) {
      // If the mutation is already in progress, await its promise
      data = await newMutation.promise as Data;
    } else {
      // Automatically mutate if the generate function didn't call it already.
      // Is this reliable? :shrug:
      data = await newMutation.dispatch() as Data;
    }

    opts.onSuccess?.(data);

    return data;
  }

  return {
    dispatch,
    // TODO: Better types
    data: (mutation?.data || null) as Data | null,
    loading: mutation?.loading || false,
    error: mutation?.error || null,
    mutation,
  }
}