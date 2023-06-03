import {action, autorun, makeAutoObservable, makeObservable} from "mobx";
import {getModelState} from "./lib/getModelState";
import {assignInstanceProperties} from "./lib/assignInstanceProperties";

type Constructor<T = {}> = new (...args: any[]) => T;

type ThisTyped<T extends abstract new (...args: any) => any, U> = {
  [P in keyof U]: U[P] extends (...args: infer A) => infer R ? (this: InstanceType<T> & U, ...args: A) => R : U[P];
}

const cache: [Constructor, any, any, any][] = [];

export function castable<T extends Constructor, U>(base: T, extra: ThisTyped<T, U>) {
  return <M extends InstanceType<T>>(model: M): M & U => {
    // Check cache
    const cached = cache.find(([cachedBase, cachedExtra, cachedModel]) =>
      cachedBase === base && cachedExtra === extra && cachedModel === model
    );

    if (cached) {
      return cached[3] as M & U;
    }

    // Create the base object using existing model as prototype
    const baseObj = new base({ ...model }, false)

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
    const observableObj = makeAutoObservable(finalObj) as M & U;

    // Cache the observable object
    cache.push([base, extra, model, observableObj]);

    // Setup autorun to sync state with the model
    autorun(() => {
      const state = getModelState(model);

      Object.assign(observableObj, state);
    });

    return observableObj;
  };
}

export function dumpCastableCache() {
  cache.length = 0;
}