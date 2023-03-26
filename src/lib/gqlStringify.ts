/**
 * Stringify a value to be used in a GraphQL query argument
 *
 * i.e.
 *
 * ```ts
 * gqlStringify({ foo: 'bar' })
 * // => "{foo: "bar"}"
 * ```
 *
 * @param value
 */
export function gqlStringify(value: any): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  } else if (Array.isArray(value)) {
    return `[${value.map(gqlStringify).join(', ')}]`;
  } else if (typeof value === 'object') {
    return `{${Object.keys(value).map(key => `${key}: ${gqlStringify(value[key])}`).join(', ')}}`;
  } else {
    return `${value}`;
  }
}