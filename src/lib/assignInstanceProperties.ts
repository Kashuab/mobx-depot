export function assignInstanceProperties<T extends object>(target: T, source: T, assigned: T[] = []) {
  // Prevent infinite recursion in case of circular references
  if (assigned.includes(target)) return;

  assigned.push(target);

  for (const key in source) {
    if (!source.hasOwnProperty(key)) continue;

    const sourceValue = source[key];
    let targetValue;

    try {
      targetValue = target[key];
    } catch (err) {
      // Probably a selection error.
    }

    // Ignore undefined target values, as they may not have been selected in GraphQL
    if (sourceValue === undefined && targetValue !== undefined) continue;

    // Make sure we're only copying data over, no methods.
    if (typeof sourceValue === 'function') continue;

    // Deep merge any objects as to not lose existing state. Retain the target's reference.
    if (targetValue && sourceValue && !(sourceValue instanceof Array) && typeof sourceValue === 'object') {

      assignInstanceProperties(targetValue, sourceValue, assigned as any); // TODO: Types
    } else {
      target[key] = sourceValue;
    }
  }
}