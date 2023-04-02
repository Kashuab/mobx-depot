import {isEnum} from "../enums";

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
 * If the value is marked as an enum via `defineEnum`, it will not be quoted.
 *
 * @param value
 */
export function gqlStringify(value: any): string {
  if (isEnum(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(v => gqlStringify(v)).join(', ')}]`;
  }

  if (typeof value === 'object') {
    return `{${Object.keys(value).map(key => `${key}: ${gqlStringify(value[key])}`).join(', ')}}`;
  }

  return `${value}`;
}