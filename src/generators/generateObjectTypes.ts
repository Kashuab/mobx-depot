import {
  IntrospectionInputObjectType,
  IntrospectionQuery,
  IntrospectionTypeRef
} from "graphql/utilities";
import {indentString} from "../lib/indentString";
import {getTypeName, typeIsNullable} from "./ModelGenerator";
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {referencesScalar, scalarIsPrimitive} from "./generateScalars";
import {referencesEnumType} from "./generateEnums";

export function generateObjectTypes(introspection: IntrospectionQuery): string {
  const objectTypes = introspection.__schema.types
    .filter(referencesObjectType) as IntrospectionObjectType[];

  const types = objectTypes.reduce((acc, objectType) => {
    return acc + `
export type ${objectType.name} = {
${objectTypeProperties(objectType)}
}
    `
  }, '');

  return `
export namespace ObjectTypes {
${indentString(types, 2)}
}
  `;
}

export function objectTypeProperties(objectType: IntrospectionObjectType | IntrospectionInputObjectType) {
  const fields = ('fields' in objectType && objectType.fields)
    ? objectType.fields
    : ('inputFields' in objectType && objectType.inputFields)
      ? objectType.inputFields
      : null;

  if (!fields) {
    console.error(objectType);
    throw new Error(`Expected fields to be defined for ${objectType.name}`);
  }

  const fieldProperties = fields
    .map(field => {
      if (!('name' in field.type)) {
        console.warn('Model field does not support name', field);
        return;
      }

      let type = getTypeName(field.type);

      if (referencesObjectType(field.type)) {
        const isArray = type.endsWith('[]');
        type= getTypeName(field.type, { stripArrayType: true });

        if (isArray) type += '[]';
      }

      const isNullable = typeIsNullable(field.type);
      if (isNullable) type += ' | null';

      if (referencesScalar(field.type) && !scalarIsPrimitive(field.type)) {
        type = 'Scalars.' + type;
      }

      if (referencesEnumType(field.type)) {
        type = 'Enums.' + type;
      }

      // `declare` here avoids conflicts in regards to tsconfig option "useDefineForClassFields"
      // See: https://github.com/microsoft/TypeScript/issues/35081
      return indentString(`${field.name}: ${type};`, 2);
    })
    .filter(Boolean)

  return [
    indentString(`__typename: '${objectType.name}';`, 2),
    ...fieldProperties
  ].join('\n');
}

export function referencesObjectType(type: IntrospectionTypeRef): boolean {
  if ((type.kind === 'NON_NULL' || type.kind === 'LIST') && type.ofType) {
    return referencesObjectType(type.ofType);
  }

  if (type.kind !== 'OBJECT') return false;
  if (type.name?.startsWith('__')) return false;
  if (type.name === 'Query') return false;
  if (type.name === 'Mutation') return false;
  if (type.name === 'Subscription') return false;

  return true;
}

