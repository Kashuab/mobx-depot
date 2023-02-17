import { $mobx, isObservable, makeObservable } from 'mobx';

/**
 * A workaround for MobX's lack of support for subclassing in regards to makeAutoObservable.
 */
export function makeModelObservable(...args: Parameters<typeof makeObservable>) {
  const [target, overrides, options] = args;

  const annotationsSymbol = Symbol("annotationsSymbol");
  const objectPrototype = Object.prototype;

  // Make sure nobody called makeObservable/makeAutoObservable/extendObservable/makeModelObservable previously (eg in parent constructor)
  if (isObservable(target)) {
    throw new Error("Target must not be observable");
  }

  // TODO: Types
  let annotations = (target as any)[annotationsSymbol];

  if (!annotations) {
    annotations = {}

    const proto = Object.getPrototypeOf(target)
    let current = target;

    while (current && current !== objectPrototype) {
      Reflect.ownKeys(current).forEach(key => {
        if (key === $mobx || key === 'constructor') return;
        annotations[key] = !overrides ? true : key in overrides ? overrides[key] : true
      });

      current = Object.getPrototypeOf(current);
    }

    // Cache if class
    if (proto && proto !== objectPrototype) {
      Object.defineProperty(proto, annotationsSymbol, { value: annotations });
    }
  }

  return makeObservable(target, annotations, options);
}