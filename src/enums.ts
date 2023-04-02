const enumSymbol = Symbol('__enum');

export function defineEnum(type: object) {
  if (typeof type !== 'object') {
    throw new Error(`Enum must be an object, got ${typeof type}`);
  }

  for (const key in type) {
    if (type.hasOwnProperty(key)) {
      const value = type[key as keyof typeof type] as string | number;

      let enumValue;

      switch (typeof value) {
        case 'string':
          enumValue = new String(value);
          break;
        case 'number':
          enumValue = new Number(value);
          break;
        default:
          throw new Error(`Enum values must be strings or numbers, got ${typeof value} for ${key}`);
      }

      Object.defineProperty(enumValue, enumSymbol, { value: true, writable: false, configurable: false });
      Object.defineProperty(type, key, { value: enumValue, writable: false, configurable: false });
    }
  }
}

export function isEnum(value: any) {
  return value[enumSymbol] === true;
}