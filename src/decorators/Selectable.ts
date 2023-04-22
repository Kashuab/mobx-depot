export function Selectable() {
  return function(target: any, propertyKey: string) {
    const selectableKey = `__selectable:${propertyKey}`;

    const getter = function(this: any) {
      const value = this[selectableKey];

      if (value === undefined) {
        throw new Error(`Field ${propertyKey} is not selected`);
      }

      return value;
    };

    const setter = function(this: any, newVal: any) {
      this[selectableKey] = newVal;
    };

    Object.defineProperty(target, propertyKey, {
      enumerable: true,
      get: getter,
      set: setter
    });

    Object.defineProperty(target, selectableKey, {
      enumerable: false,
      writable: true
    });
  }
}