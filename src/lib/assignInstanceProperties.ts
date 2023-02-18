export function assignInstanceProperties<T extends object>(target: T, source: T) {
  for (const key in source) {
    if (!source.hasOwnProperty(key)) continue;

    const sourceValue = source[key];
    const targetValue = target[key];

    // Ignore undefined target values, as they may not have been selected in GraphQL
    if (sourceValue === undefined) continue;

    // Make sure we're only copying data over, no methods.
    if (typeof sourceValue === 'function') continue;

    // Deep merge any objects as to not lose existing state. Retain the target's reference.
    if (targetValue && sourceValue && !(sourceValue instanceof Array) && typeof sourceValue === 'object') {
      assignInstanceProperties(targetValue, sourceValue);
    } else {
      target[key] = sourceValue;
    }
  }
}