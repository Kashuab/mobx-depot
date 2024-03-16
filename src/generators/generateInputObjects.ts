import {
  IntrospectionInputObjectType,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionTypeRef
} from "graphql/utilities";
import {objectTypeProperties} from "./generateObjectTypes";
import {indentString} from "../lib/indentString";

export function generateInputObjects(introspection: IntrospectionQuery) {
  const inputObjects = introspection.__schema.types.filter(referencesInputObjectType) as IntrospectionInputObjectType[];

  const inputObjectDefs = inputObjects.reduce((acc, inputObject) => {
    const props = objectTypeProperties(inputObject);

    return acc + `export type ${inputObject.name} = {
${props}
}\n
`;
  }, '');

  return `
export namespace InputObjects {
${indentString(inputObjectDefs, 2)}
} 
  `;
}

export function referencesInputObjectType(type: IntrospectionTypeRef): type is IntrospectionInputObjectType {
  if (type.kind == 'LIST' || type.kind == 'NON_NULL') {
    if (!type.ofType) throw new Error('Expected ofType to be defined');

    return referencesInputObjectType(type.ofType);
  }

  return type.kind === 'INPUT_OBJECT' && !type.name.startsWith('__');
}