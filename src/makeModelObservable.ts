import { $mobx, isObservable, makeObservable } from 'mobx';

/**
 * A workaround for MobX's lack of support for subclassing in regards to `makeAutoObservable`.
 * Only use this when you want to use `makeAutoObservable` in conjunction with a subclass,
 * where its parent(s) are not observables themselves.
 *
 * See MobX discussion: https://github.com/mobxjs/mobx/discussions/2850
 * See original gist: https://gist.github.com/stephenh/77f62941913203a871d0e284ea779fe9
 */
export function makeModelObservable<T extends object, AdditionalKeys extends PropertyKey = never>(
  ...args: Parameters<typeof makeObservable<T, AdditionalKeys>>
) {
  const [target, overrides, options] = args;

  const annotationsSymbol = Symbol("annotationsSymbol");
  const objectPrototype = Object.prototype;

  // Make sure nobody called makeObservable/makeAutoObservable/extendObservable/makeModelObservable previously
  // (eg in parent constructor)
  if (isObservable(target)) {
    throw new Error("Target must not be observable");
  }

  // TODO: Types
  let annotations = (target as any)[annotationsSymbol];

  if (!annotations) {
    annotations = {}

    const proto = Object.getPrototypeOf(target)

    // This was previously `let current = proto` but it was missing some properties within the annotations.
    let current = target;

    while (current && current !== objectPrototype) {
      Reflect.ownKeys(current).forEach(key => {
        if (key === $mobx || key === 'constructor') return;
        annotations[key] = !overrides ? true : key in overrides ? overrides[key as keyof typeof overrides] : true
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