export function Selectable() {
  return function(target: any, propertyKey: string) {
    const privateKeySymbol = Symbol(`selectable:${propertyKey}`);

    const getter = function(this: any) {
      const value = this[privateKeySymbol];

      if (value === undefined) {
        throw new Error(`Field ${propertyKey} is not selected`);
      }

      return value;
    };

    const setter = function(this: any, newVal: any) {
      this[privateKeySymbol] = newVal;
    };

    Object.defineProperty(target, propertyKey, {
      enumerable: true,
      get: getter,
      set: setter
    });
  }
}