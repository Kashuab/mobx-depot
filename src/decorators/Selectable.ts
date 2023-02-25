export function Selectable() {
  return function(target: Object, propertyKey: string) {
    let value: any;

    const getter = function() {
      if (value === undefined) throw new Error(`Field ${propertyKey} is not selected`);
      return value;
    };

    const setter = function(newVal: any) {
      value = newVal;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter
    });
  }
}