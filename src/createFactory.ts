import {autorun, makeAutoObservable} from "mobx";
import {ObjectType} from "./RootStore";

type ThisTyped<T extends ObjectType, U> = {
  [P in keyof U]: U[P] extends (...args: infer A) => infer R ? (this: T & U, ...args: A) => R : U[P];
}

const cache: [any, any, any, any][] = [];

export function createFactory<T extends ObjectType>() {
  return <U>(extra: ThisTyped<T, U>) => {
    return (object: T): T & U => {
      const typename = object.__typename;

      // Check cache
      const cached = cache.find(([cachedTypename, cachedExtra, cachedObject]) =>
        cachedTypename === typename && cachedExtra === extra && cachedObject === object
      );

      if (cached) {
        return cached[3] as T & U;
      }

      // Create the base object using existing model as prototype
      const baseObj = {
        ...object,
      }

      // Combine baseObj and extra
      const finalObj = Object.assign(baseObj, extra);

      // Bind functions to finalObj
      for (const prop in extra) {
        const value = extra[prop];

        if (typeof value === 'function') {
          finalObj[prop] = value.bind(finalObj);
        }
      }

      // Make the final object observable
      const observableObj = makeAutoObservable(finalObj) as T & U;

      // Cache the observable object
      cache.push([typename, extra, object, observableObj]);

      // Setup autorun to sync state with the original object
      autorun(() => {
        const state = getState(object);

        Object.assign(observableObj, state);
      });

      return observableObj;
    };
  };
}

export function getState(object: object) {
  const state = {};

  for (const prop in object) {
    const typedProp = prop as keyof typeof object;
    let value;

    try {
      value = object[typedProp];
    } catch (err) {
      // Selection error
      continue;
    }

    if (typeof value !== 'function') {
      state[typedProp] = value;
    }
  }

  return state;
}