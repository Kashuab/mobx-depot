import {getAtom} from "mobx";

const blacklistedKeys = ['__typename'];

export function assignInstanceProperties<T extends object>(target: T, source: T, assigned: T[] = []) {
  // Prevent infinite recursion in case of circular references
  if (assigned.includes(target)) return;

  assigned.push(target);

  const keys = (Object.getOwnPropertyNames(source) as (keyof T)[])
    .filter(key => !blacklistedKeys.includes(key as string));

  for (const key of keys) {
    let sourceValue;

    try {
      sourceValue = source[key];
    } catch (err) {
      // Probably a selection error, ignore this field
      continue;
    }

    let targetValue;

    try {
      targetValue = target[key];
    } catch (err) {
      // Probably a selection error. OK to continue.
    }

    // Ignore undefined target values, as they may not have been selected in GraphQL
    if (sourceValue === undefined && targetValue !== undefined) continue;

    // Make sure we're only copying data over, no methods.
    if (typeof sourceValue === 'function') continue;

    // Deep merge any objects as to not lose existing state. Retain the target's reference.
    if (targetValue && sourceValue && !(sourceValue instanceof Array) && typeof sourceValue === 'object') {
      assignInstanceProperties(targetValue, sourceValue, assigned as any); // TODO: Types
    } else {
      // MobX can define setters on properties which are designed to throw an error,
      // so we need to introspect the property to see if it has an original setter.
      if (!propertyIsWritable(target, key)) continue;

      target[key] = sourceValue;
    }
  }
}

function propertyIsWritable<T, K extends keyof T>(obj: T, prop: K) {
  try {
    const atom = getAtom(obj, prop);

    if (atom && 'setter_' in atom) {
      if (!atom.setter_) return false;
    }
  } catch (err) {
    // getAtom can throw an error if the property is not defined
  }

  return true;
}