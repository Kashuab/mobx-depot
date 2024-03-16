import {
  IntrospectionEnumType,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionTypeRef
} from "graphql/utilities";
import {indentString} from "../lib/indentString";

export function generateEnums(introspection: IntrospectionQuery) {
  const enums = introspection.__schema.types.filter(
    type => referencesEnumType(type) && !type.name.startsWith('__')
  ) as IntrospectionEnumType[];

  const enumDefs = enums.reduce((acc, enumType) => {
    const union = enumType.enumValues.map(enumValue => `"${enumValue.name}"`).join(' | ');

    return acc + `export type ${enumType.name} = ${union};`;
  }, '');

  return `export namespace Enums {
${indentString(enumDefs, 2)}
}
  `;
}

export function referencesEnumType(type: IntrospectionTypeRef): boolean {
  if (type.kind == 'LIST' || type.kind == 'NON_NULL') {
    if (!type.ofType) throw new Error('Expected ofType to be defined');

    return referencesEnumType(type.ofType);
  }

  return type.kind === 'ENUM';
}