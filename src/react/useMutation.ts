import {useState} from "react";

// TODO: Better types
interface IMutation {
  data: unknown;
  loading: boolean;
  setArgs: (...args: any[]) => void;
  mutatePromise: Promise<unknown> | null;
  mutate: () => Promise<unknown>;
}

/**
 * When using a method on a class that returns the mutation, don't pass it in directly. Use an arrow function:
 * `useMutation(() => user.create())` instead of `useMutation(user.create)` Otherwise, the context of `this` will be
 * lost, resulting in a runtime error.
 *
 * @param generate A function that returns a `Mutation` instance.
 */
export function useMutation<Mutation extends IMutation, Data extends Exclude<Mutation['data'], null>>(generate: () => Mutation) {
  const [mutation, setMutation] = useState<Mutation | null>(null);

  const dispatch = async (): Promise<Data> => {
    const newMutation = generate();

    setMutation(newMutation);

    if (newMutation.mutatePromise) {
      // If the mutation is already in progress, await its promise
      return await newMutation.mutatePromise as Data;
    }

    // Automatically mutate if the generate function didn't call it already.
    // Is this reliable? :shrug:
    return await newMutation.mutate() as Data;
  }

  return {
    dispatch,
    // TODO: Better types
    data: (mutation?.data || null) as Data | null,
    loading: mutation?.loading || false,
    mutation,
  }
}